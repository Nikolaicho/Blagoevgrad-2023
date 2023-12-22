import axios from "axios";
import Cookies from 'universal-cookie';

const cookies = new Cookies();
//тeзи бисквитки са времененни и незащитени!
function setAuthCookies(accessToken,refreshToken){
  cookies.set("accessToken", accessToken, {
    maxAge: 60*10 , // 15 минути в секунди
  });
  cookies.set("refreshToken", refreshToken, {
    maxAge: 60*60 , // 5 chasa
  });
}
function submitRegisterForm(){
  const url="http://localhost:3001/register"
  let username=document.getElementById("username").value
  let password=document.getElementById("password").value
  let email=document.getElementById("email").value
  
  let newUserData={
    username:username,
    password:password,
    email:email
  }

  axios.post(url,newUserData).then((res)=>{
    window.console.log(res.data)
    setAuthCookies(res.data["accessToken"],res.data["refreshToken"])
  })

}

function submitSignInForm(){
  let username=document.getElementById("username").value
  let password=document.getElementById("password").value

  let newUserData={
    identifier:username,
    password:password,
  }

  axios.post("http://localhost:3001/sign-in",newUserData).then((res)=>{
    setAuthCookies(res.data["accessToken"],res.data["refreshToken"])
  })
}

function console(){
  const accessToken=cookies.get("accessToken")

  let data;
  if(accessToken == undefined){
    data={
      refreshToken:cookies.get("refreshToken") 
    }
  }

  else{
    data={
      accessToken:cookies.get("accessToken") 
    }
  }

  axios.post("http://localhost:3001/console",data).then((res)=>{
    window.console.log(res)
    if(res.data["accessToken"] !== undefined){
      cookies.set("accessToken",res.data["accessToken"], {
        maxAge: 60
      });
      
    }
  })

}
function newGame(){
  axios.post("http://localhost:3001/create-new-game").then((res)=>{
    cookies.set("game_id",res.data)
  })
}

function App() {
  return (<div>
    <label for="username">Ime:</label>
      <input id="username"></input>
      <label for="password">password</label>
      <input id="password"></input>
      <input id="email"></input>
      <button onClick={submitRegisterForm}>registrirai se</button>
      <button onClick={submitSignInForm}>vlez</button>
      <button onClick={newGame}>suzdai nova igra</button>
      <button onClick={console}>qshaaa</button>
  </div>
    
  );
}


export default App;
