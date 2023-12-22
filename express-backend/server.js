const express = require("express");
const app= express();

const cors = require('cors');
app.use(cors());

const bodyParser = require('body-parser');
app.use(bodyParser.json());

require('dotenv').config();

const { MongoClient } = require("mongodb");
const mongoUrl = `mongodb+srv://chess:${process.env.DB_PASSWORD}@cluster0.unabrut.mongodb.net/?retryWrites=true&w=majority`
const mongoClient = new MongoClient(mongoUrl);
mongoClient.connect();
const db = mongoClient.db('chess');

const User = require(__dirname+"\\userModel");
const Game = require(__dirname+"\\gameModel")
const gameCollection = db.collection("games")
const users = db.collection("users")

const crypto = require('crypto');

const uuid = require("uuid")

// TODO: премахване на вече невалидни ws връзки
// предпазване от 2 връзки сочеши към един човек в couples мап с един и същи ключ
// по - обстойна проверка за създаване, използване и регенериране на тоукъни
// по широко тестване за бъгове от към ws връзките


//връзка за WebSocket сървър
const WebSocket = require('ws');
const wss = new WebSocket.Server({port:3002});

// хаш мап за двойките, които в момента играят. 
let couples = new Map()

//хаш мап за ид-та, които сочат към конкретна връзка.
let clients = new Map()

//дава id-то на връзката на противниковия играч
function getEnemyConnection(wsId,game_id){
    let connections=couples.get(game_id)

    if(wsId == connections[0])
        return connections[1]

    return connections[0]
}

//функция за вкарване на нови връзки в хаш мапа и изпращането им на потребителите.
function newConncetion(ws){
    let wsId=createID()
    clients.set(wsId,ws)

    let wsJSON={
        "type":"connection",
        "ws":wsId
    }

    ws.send(JSON.stringify(wsJSON))
    return wsId;
}

//главната функция на WS съръра, който поема целия трафик за live игри.
wss.on('connection', (ws) => {
    //създава нова връзка и я праща на потребителя, когато се свърже към сървъра.
    let wsId=newConncetion(ws)

    //функция, която слуша за съобщения от потребителя
    ws.on('message', (message) => {
        //прави приетото от клиента съобщение в JSON обект и извлича основната информация
        let parsedMessage = JSON.parse(message)
        let type = parsedMessage["type"]
        let game_id = parsedMessage["game_id"]
        let color = parsedMessage["color"]
        let connectionString = `${color} ${wsId}`

        //занимава се с установяване на връзка между противниците
        if(type == "initial"){    

            //ако вече 1 от участниците е вписан се вписва другия.
            //възможен бъг- 2 пъти да се впише един и същ човек.
            if(couples.has(game_id) && couples.get(game_id).length <2){
                let exsitingConnection = couples.get(game_id)
                exsitingConnection.push(connectionString) 
            }

            //ако все още няма вписана игра с даденото id се вписва с първия участник, който е направил заявка
            else if(couples.has(game_id) == false){
                couples.set(game_id,[connectionString])
            }

            //ако всички участници са вписани се очаква, че се е стигнало до тук защото е имало някакъв проблем с връзката.
            //заменя се предишната връзка с нова и се изпраща на потребителя
            else if(couples.has(game_id) && couples.get(game_id).length == 2){
                let existingConnections = couples.get(game_id)

                //намира се старата връзка според цвета на фигурите, който се използва по време на играта и се заменя с нова 
                if(existingConnections[0][0] == color){
                    existingConnections[0] = connectionString
                }
                else{
                    existingConnections[1] = connectionString
                }

                //запазват се промените
                couples.set(game_id,existingConnections)
            }
        }

        //ако заявката е от тип ход или ан пасан се намира връзката на противникът и се изпраща информация за хода, който е направен
        if(type == "move" || type == "ep"){
            // има .substring(2) защото връзката се пази във формат c connectionString, където c е цветът на фигурите на човекът, към който е насочена връзката 
            let wsConncectionID = getEnemyConnection(connectionString,game_id).substring(2)
            let enemyConnection = clients.get(wsConncectionID)   
            enemyConnection.send(JSON.stringify(parsedMessage))
        }
    });
  });

//тайни ключове, с които се създават jwt токени за връзка
const jwt= require("jsonwebtoken")
const accessSecretKey=process.env.ACCESS_SECRET_KEY
const refreshSecretKey=process.env.REFRESH_SECRET_KEY


function createID(){
    return uuid.v4()
}

function HashPassword(password){
    return crypto.createHash('sha256').update(password).digest('hex');
}

function getUserInfo(id){
    users.findOne({_id:id})
    return users.name
}

function generateTokens(userInfo){
    let refreshTokenInfo={
        id:userInfo['ID']
    }
    let fiveMinutes=60*5
    let oneHour=60
    const accessToken=jwt.sign(userInfo,accessSecretKey,{expiresIn:fiveMinutes})
    const refreshToken=jwt.sign(refreshTokenInfo,refreshSecretKey,{expiresIn:oneHour})
    return {
        accessToken:accessToken,
        refreshToken:refreshToken
    }
}

const verifyToken = (req, res, next) => {
    const accessToken = req.body.accessToken
    const refreshToken = req.body.refreshToken 
    if(accessToken == null){
        if(refreshToken == null){
            res.sendStatus(401)
        }
        else{
            const decoded=jwt.verify(refreshToken,refreshSecretKey)
            if(decoded.exp >= Date.now() / 1000){
                res.send({
                    accessToken:regenToken(refreshToken)
                });
            }
            else{
                res.sendStatus(401)
            }
           
        }
    }
    next();
}; 

function regenToken(refreshToken){
    const decoded = jwt.verify(refreshToken,refreshSecretKey)
    const info=getUserInfo(decoded.id)
    const newAccessToken=jwt.sign({id:info},refreshSecretKey,{expiresIn:"1m"})
    return newAccessToken
}

app.post("/register",(req,res)=>{
    //TODO:връщане на код дали действието е изпълнено или не за да има по добър ui в бъдещето 
    //TODO:санитизация на входните данни
    //TODO:коментари за функционалността
    const _id=createID();
    let newUser= new User({
        _id:_id,
        username:req.body.username,
        email:req.body.email,
        password:HashPassword(req.body.password)
    });
    users.insertOne(newUser);

    let userInfo={
        ID:_id,
        admin:false
    }
    const tokens=generateTokens(userInfo,accessSecretKey)
    const accessToken=tokens["accessToken"]
    const refreshToken=tokens["refreshToken"]
    res.send({
        accessToken:accessToken,
        refreshToken:refreshToken
    })
});


app.post('/sign-in',async(req,res)=>{
    
    //търси потребители по имейл или потребителско име
    const response=await users.findOne({
        $or: [
            {username:req.body.identifier},
            {email: req.body.identifier}
          ]
    });
    
    //ако намери резултат от търсенето хешира дадената паролата и проверява дали съвпада с хаша в DB и стартира сесия 
    if(response.password == HashPassword(req.body.password)){
        let userInfo = {
            "ID":response.id,
            "admin":false
        }
        const tokens=generateTokens(userInfo,accessSecretKey)
        const accessToken=tokens["accessToken"]
        const refreshToken=tokens["refreshToken"]

        res.send({
            accessToken:accessToken,
            refreshToken:refreshToken
        }) 
    }
    })

app.post("/sign-out",(req,res)=>{
    //sessions_collection.deleteOne({_id:req.body.session})
    users.deleteMany({})
})
app.post("/create-new-game",(req,res)=>{
    let id=createID();
    let game=new Game({
        _id:id,
        white_id:"",
        black_id:"",
        game:[],
        result:"",
        moves:"",
    })
    
    gameCollection.insertOne(game)
    res.send(id)
})

app.listen(3001)
