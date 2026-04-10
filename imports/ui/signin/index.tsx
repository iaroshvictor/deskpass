import * as React from 'react';
import { Meteor } from "meteor/meteor";
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import { styled } from '@mui/material/styles';
import { SitemarkIcon } from './CustomIcons';
const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: 'auto',
  backgroundColor:'rgba(255, 255, 255, 0.1)',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '450px',
  },
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

const SignInContainer = styled(Stack)(({ theme }) => ({
  padding: 20,
  marginTop: '10vh',
  '&::before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    backgroundSize:'cover',
    backgroundImage: 'radial-gradient(at 50% 50%, rgb(0 0 0 / 64%), rgb(0 0 0 / 52%))',
    backgroundRepeat: 'no-repeat',
    ...theme.applyStyles('dark', {
      backgroundImage:
        'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))',
    }),
  },
  '&::after': {
    content: '""',
    display: 'block',
    position: 'absolute',
    zIndex: -2,
    inset: 0,
    background: 'url(lock-wallpaper.webp)',
    backgroundSize:'cover',
    backgroundRepeat: 'no-repeat',
  },
}));

export default function SignIn() {
  const [usernameError, setUsernameError] = React.useState(false);
  const [usernameErrorMessage, setUsernameErrorMessage] = React.useState('');
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState('');
  const [loginError, setLoginError] = React.useState('')
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if(!(usernameError || passwordError)){
      Meteor.loginWithPassword(
        data.get('username') as string,
        data.get('password') as string,
        (error?: Error | Meteor.Error | TypeError | undefined)=>{
          if(error && error instanceof Meteor.Error)
            setLoginError(error.reason||'')
            Meteor.setTimeout(()=>setLoginError(''), 5000)
        })
    }
  };

  const validateInputs = () => {
    const username = document.getElementById('username') as HTMLInputElement;
    const password = document.getElementById('password') as HTMLInputElement;

    let isValid = true;

    if (!username.value || !/\S/.test(username.value)) {
      setUsernameError(true);
      setUsernameErrorMessage('Please enter a valid username address.');
      isValid = false;
    } else {
      setUsernameError(false);
      setUsernameErrorMessage('');
    }

    if (!password.value || password.value.length < 5) {
      setPasswordError(true);
      setPasswordErrorMessage('Password must be at least 5 characters long.');
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage('');
    }

    return isValid;
  };
  return (
      <SignInContainer className='signinBox' direction="column" justifyContent="space-between">
        <Card variant="outlined">
          <Box
            sx={{display:'flex', justifyContent:'center'}}
          >
             <SitemarkIcon />
          </Box>
         
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              gap: 2,
            }}
          >
            <FormControl>
              <TextField
                variant='standard'
                error={usernameError}
                helperText={usernameErrorMessage}
                id="username"
                type="text"
                name="username"
                placeholder="username"
                autoComplete="username"
                autoFocus
                required
                fullWidth
                color={usernameError ? 'error' : 'primary'}
                sx={{ ariaLabel: 'User Name', textAlign:'center' }}
              />
            </FormControl>
            <FormControl>
              <TextField
                error={passwordError}
                helperText={passwordErrorMessage}
                name="password"
                placeholder="••••••"
                type="password"
                id="password"
                autoComplete="current-password"
                autoFocus
                required
                fullWidth
                variant="standard"
                color={passwordError ? 'error' : 'primary'}
                sx={{ ariaLabel: 'Password', textAlign:'center'}}
              />
            </FormControl>
            {loginError &&
               <Alert severity="error">{loginError}</Alert>
            }
            <IconButton color="primary" aria-label="Log in" type='submit' onClick={validateInputs}>
                <ExitToAppIcon />
            </IconButton>
          </Box>
        </Card>
      </SignInContainer>
  );
}