import * as React from 'react';
import CamForm  from './camForm';
import { useSubscribe, useFind } from 'meteor/react-meteor-data';
import {ZonesCollection} from '/imports/api/zones';
import { Snackbar, Paper } from '@mui/material';

import { AppProps } from '../..';
const EditCamAppRender = (props:AppProps)=>{
    useSubscribe('zones');
    const cam = props.extraConfigs && props.extraConfigs.cam ? props.extraConfigs.cam : null;
    const Zones = useFind(() => ZonesCollection.find());
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

    return(
    <>
    <Paper sx={{ minHeight: '100%', p: 2, boxSizing: 'border-box' }}>
        {cam && (
            <>
                <CamForm Cam={cam} Zones={Zones} setErrorMessage={setErrorMessage} />
                {errorMessage && (
                    <Snackbar
                        open={!!errorMessage}
                        autoHideDuration={6000}
                        onClose={() => setErrorMessage(null)}
                        message={errorMessage}
                    />
                )}
            </>
        )}
    </Paper>
    </>)
}
export default EditCamAppRender