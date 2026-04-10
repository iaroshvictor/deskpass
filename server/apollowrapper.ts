import { AxiosInstance } from "axios";
import { RedisClientType } from 'redis';

import axios from 'axios';
import { Client } from 'node-signalr';
import { EventEmitter } from 'events';
import redisClient from './redisclient';
export type APISettings = {
    server:string;
    user:string;
    password:string;
}
export type CardHolder = {
    "Id":number,
    "CardholderId": number,
    "LastName": string,
    "FirstName": string
    "MiddleName": string
    "Department": string
    "Title": string
    "WorkPhoneNumber": string | undefined,
    "MobilePhoneNumber": string | undefined,
    "EmployeeId": string,
    "VacationStart": string | null,
    "VacationEnd":  string | null,
    "AdvancedFields": {
        "Fields": {[name:string]:string},
        "Id": number,
        "TypeId": "AdvancedFields"
    } | null,
    "Photo": any,
    "TypeId": "Cardholder",
    "Group":{
        "Id": number,
        "Label": string,
        "TypeId": "CardholderGroup"
    }
    CardsIssue: CardIssue[]
}

export type CardIssue = {
  IsActive?: string
  CardsIssued?: string,
  CardHoldersQt?: string,
  CardsQt?: string,
  ItemsLength?: string,
  Label?: string,
  ExcludedReaders?: string,
  IncludedReaders?: string,
  CardHolders?: string,
  "CardHolders>Cards"?: string,
  "CardId": number,
  "LongCardId": number,
  "IssueType": number,
  "Active": boolean,
  "PIN":string |  null,
  "APBCheck": boolean,
  "ActivationDate": string,
  "DeactivationDate": string,
  "LongAccess": boolean,
  "BioCard": boolean,
  "UUID": null,
  "CertHash1": null,
  "CertHash2": null,
  "Id": number,
  "TypeId": "CardIssue",
}
class ApolloWrapper extends EventEmitter {
  ApiSettings: APISettings;
  api: AxiosInstance;
  signalSocket: Client;
  watcher: NodeJS.Timeout | null;
  isConnected: boolean;
  retryTimeout: NodeJS.Timeout | null;
  redis: RedisClientType;
  constructor(ApiSettings : APISettings) {
    super();
    this.ApiSettings = ApiSettings;
    this.isConnected = false;
    this.retryTimeout = null;
    this.api = axios.create({
      baseURL: this.ApiSettings.server,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(this.ApiSettings.user + ':' + this.ApiSettings.password).toString('base64'),
      },
    });
    this.signalSocket = new Client(`${this.ApiSettings.server}/rtevent/signalr`, ['ApacsHub']);
    this.signalSocket.callTimeout = 10000;
    this.signalSocket.requestTimeout = 10000;
    this.redis = redisClient.duplicate();
    this.redis.connect().catch((err) => {
      console.error('Apollo Redis client connection error:', err?.message || err);
    });
    // Handle connection errors to prevent crashes
    // Note: SignalR errors should not affect the API connected status
    // since the HTTP API can work independently of the SignalR socket
    this.signalSocket.on('error', (err: any) => {
      console.error('Apollo SignalR socket error:', err?.message || err);
      // Only emit connectionError if we're not already connected via HTTP API
      if (!this.isConnected) {
        this.emit('connectionError', err);
      }
      this.stop()
      this.initialize()
    });

    this.signalSocket.on('disconnected', (reason: string) => {
      console.log('Apollo SignalR socket disconnected:', reason);
      // SignalR disconnect doesn't mean API is offline - only log it
      // The HTTP API can still work without SignalR
    });

    this.signalSocket.on('connected', async () => {
      console.log('Apollo SignalR socket connected.');
    });
    this.signalSocket.connection.hub.on('ApacsHub', 'onEvent', (e:any) => {
      this.emit('liveEvent', e);
    });
    this.signalSocket.connection.hub.on('ApacsHub', 'onState', (s:any) => {
      this.emit('liveState', s);
    });
    this.signalSocket.connection.hub.on('ApacsHub', 'onChange', (s:any) => {
      this.emit('liveAudit', s);
    });
    // onChange(AuditLogRecord)
    this.watcher=null
  }
  async stop () {
    try {
      if(this.watcher){
        clearInterval(this.watcher);
        this.watcher = null;
      }
      this.isConnected = false;
      await this.api.get('/global/permission/logout');
      delete this.api.defaults.headers['Apacs.Session'];
      this.signalSocket.end();
    } catch (error) {
      console.log(error);
    }
  }
  async refreshSession() {
    if (this.isConnected) {
      try {
        const response = await this.api.get('/hereiam');
        if (response.status === 200 || response.status === 204) {
          console.log('Apollo API: Session refreshed');
          return true;
        }else{
          this.isConnected = false;
          this.emit('disconnected', 'Session refresh failed');
          this.initialize();
        }
      }catch (error) {
        console.log(error);
      }
    }
  }
  async initialize(): Promise<boolean> {
    try {
       if (!this.redis.isOpen) {
        await this.redis.connect();
      }
      if(this.watcher){
        clearInterval(this.watcher);
        this.watcher = null;
      }
      if(this.retryTimeout){
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      console.log('Apollo API: Attempting login...');
     
      let token = await this.redis.get('apacs_session');
      let validToken = false;
      let status = ''
      console.log('cached token:', token)
      if(token){
        this.api.defaults.headers['Apacs.Session'] = token;
        try {
          const response = await this.api.get('/hereiam');
          console.log('Apollo API: Here I am response', response.status);
          if (response.status === 200 || response.status === 204) {
            validToken = true;
          }
        } catch (err: any) {
          console.log('Apollo API: Cached token invalid, will re-login. Error:', err?.response?.status || err?.message);
          //remove the header and cached token since it is not valid
          delete this.api.defaults.headers['Apacs.Session'];
          await this.redis.del('apacs_session');
        }
      }
      if(!validToken){
        const response = await this.api.get('/global/permission/login');
        console.log('Apollo API: Login response', response.status);
        if (response.status === 200) {
          this.api.defaults.headers['Apacs.Session'] = response.headers['apacs.session'];
          await this.redis.set('apacs_session', response.headers['apacs.session']);
          token = response.headers['apacs.session'];
          validToken = true;
        } else {
          status = `${response.status}`
        }
      }
      if(token && validToken){
        console.log('Apollo API: Login successful');
        this.signalSocket.qs = {
          'Apacs.Auth': `${Buffer.from(`${this.ApiSettings.user}:${this.ApiSettings.password}`).toString('base64')}`,
          'Apacs.Session': token,
        };

        // Mark as connected since HTTP API login succeeded
        this.isConnected = true;
        this.emit('connected');

        // Start SignalR socket (optional, for live events)
        try {
          this.signalSocket.start();
        } catch (socketErr: any) {
          console.error('Apollo SignalR socket failed to start:', socketErr?.message || socketErr);
          this.isConnected = false;
          this.emit('connectionError', socketErr);
          this.scheduleRetry();
          return false;
        }

        this.watcher = setInterval(async() => {
          //refresh the session every 59 minutes
          this.refreshSession();
        }, 5*60*1000);
        return true;
      }
      console.error('Apollo API login failed with status:', status);
      this.isConnected = false;
      this.emit('connectionError', { message: `Login failed with status ${status}` });
      this.scheduleRetry();
      return false;
    } catch (error: any) {
      console.error('Apollo API initialization error:', error?.message || error);
      this.isConnected = false;
      this.emit('connectionError', error);
      this.scheduleRetry();
      return false;
    }
  }

  private scheduleRetry() {
    if (this.retryTimeout) return; // Already scheduled
    console.log('Apollo API: Will retry connection in 30 seconds...');
    this.retryTimeout = setTimeout(async () => {
      this.retryTimeout = null;
      console.log('Apollo API: Retrying connection...');
      await this.initialize();
    }, 30000);
  }

  async DeleteData(fetchpath:string) {
    try{
      await this.api.delete(fetchpath)
    } catch (error) {
      if (axios.isAxiosError(error)) {
      } else {
        console.log(`Unexpected error: ${error}`);
      } 
    }
    return true
  }
  async getData(fetchpath:string) {
    let response;
    try{
      response = (await this.api.get(fetchpath)).data
    } catch (error) {
      if (axios.isAxiosError(error)) {
      } else {
        console.log(`Unexpected error: ${error}`);
      } 
    }
    return response
  }
  async getImageData(fetchpath:string) {
    let response;
    try{
      response = (await this.api.get(fetchpath, {responseType: 'arraybuffer'})).data
    } catch (error) {
      if (axios.isAxiosError(error)) {
      } else {
        console.log(`Unexpected error: ${error}`);
      } 
    }
    return response
  }
  async postData(fetchpath:string, data:any) {
    let response;
    try{
      response = (await this.api.post(fetchpath, data)).data
    } catch (error) {
      if (axios.isAxiosError(error)) {
      } else {
        console.log(`Unexpected error: ${error}`);
      } 
    }
    return response
  }
  async putData(fetchpath:string, data :any) {
    let response;
    try{
      response = (await this.api.put(fetchpath, data)).data
    } catch (error) {
      if (axios.isAxiosError(error)) {
      } else {
        console.log(`Unexpected error: ${error}`);
      } 
    }
    return response
  }
}

export default ApolloWrapper;