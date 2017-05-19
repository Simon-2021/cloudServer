const express = require('express');
const WebSocketServer = require('ws').Server;
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();

const aimHost ='119.23.254.236';

let db = new sqlite3.Database('server.sqlite3');
let machines = [];
let orders = [];

db.all("SELECT *  FROM machines", (err, datas) => {         //初始化，查询并建立机床数组
    for (let data of datas) {
        let machine = {
            machineNum: data.num,
            machineName: data.name, 
            machineModel: data.model,
            machineIp: data.ip,
            machineHours: data.workHours,
            machineDate: data.entryDate,
            machineStatus: 0
        };
        machines.push(machine);
    }
    // console.log(machines);
});

// db.all("SELECT * FROM orders", (err, datas) => {           //初始化，查询并建立订单数组
//     for (let data of datas) {
//         let order = {
//             num: data.num,
//             owner: data.owner,
//             amount: data.amount,
//             complete: data.complete,
//             begin: data.begin,
//             end: data.end
//         }
//         orders.push(order);
//     }
//     console.log(orders);
// });

router.post('/login',(req, res) => {            //用户登录验证与users数据库
    let name = req.body.name;
    let pwd = req.body.pwd;
    let type = req.body.type;

    let sendData = {
        status: '',
        msg: '',
        name:'',
        type: 0 ,
        compony:'',
        tel:'',
        email:'',
    };
    // console.log('username: ' + name + '\npassword: ' + pwd + '\ntype:' + type);
    db.get("SELECT * FROM users WHERE name = '" + name + "'  AND type = '" + type + "' ", function(err, data){
        // console.log(data);
        if(err){
            console.log("数据库错误");
            sendData.status = 'failure';
            sendData.msg = '服务器错误';
        }else if(data && data.authorized == "true"){
        if(pwd == data.pwd){
                console.log("登录成功");
                // console.log('username: ' + data.name + '\npassword: ' + data.pwd+ '\ntype:' + data.type);
                sendData.status = 'success';
                sendData.msg = '登录成功';
                sendData.name = data.name;
                sendData.type = data.type;
                sendData.compony = data.compony;
                sendData.tel = data.tel;
                sendData.email = data.email;
            }else{
                console.log("密码错误")
                // console.log('username: ' + data.name + '\npassword: ' + data.pwd);
                sendData.status = 'failure';
                sendData.msg = '密码错误，请重试';
            }
        }else{
            console.log("用户名或帐户类型错误");
            sendData.status = 'failure';
            sendData.msg = '用户名和帐户类型错误，或未取得授权';
        }
        console.log(sendData);
        res.send(JSON.stringify(sendData));
    });
});

router.get('/getMachines', (req, res) => {     //上位机获取空闲机床和未完成订单
    let sendData =[];
    db.all("SELECT num , name FROM machines WHERE num NOT IN ( SELECT machine FROM tasks WHERE complete == 'false' ) ", (err, machineData) => {
        db.all("SELECT num FROM orders WHERE amount > worked", (err, orderData) => {
            sendData = [machineData, orderData];
            res.send(sendData);
        });
    });
});

router.post('/updateTask', (req, res) => {      //上位机发布任务与tasks数据库通信
    console.log(req.body);
    let receData = req.body;
    let count = 0;
    db.get("SELECT COUNT(*) AS 'count' FROM tasks", (err, data) => {
        count = data.count + 1;
        db.run("INSERT INTO tasks VALUES ( '" + count + "','" + receData.taskName + "','" + receData.machine + "','" + receData.operator + "','" + receData.order + "','" + receData.wireDiameter + "','" + receData.partMaterial + "','" + receData.partThickness + "','" + receData.cutFluid + "','" + receData.time + "','" + "false" + "') ");
        db.run("UPDATE orders SET worked =  worked + '" + 1 + "' WHERE num = '" + receData.order + "' ");
        let sendData = {
            status: 'success',
            taskNum: count
        }
        console.log(sendData.taskNum);
        res.send(JSON.stringify(sendData));
    });
});

router.post('/visitOrders', (req, res) => {     //与客户端通信，展示订单列表
    let visitName = req.body.name;
    // console.log(visitName);
    db.all("SELECT * FROM orders WHERE owner = '" + visitName + "' ", (err, data) => {
        // console.log(data); 
        // console.log(err);  
        res.send(data);
    });
});

router.post('/visitOrderDetail', (req, res) => { //与客户端通信，展示订单所属的机床和任务信息
    let orderNum = req.body.orderNum;
    let sendData = [];
    // console.log(orderNum);
    db.all("SELECT name , machine , complete FROM tasks WHERE orderNum = '" + orderNum + "' ", (err, taskData) => {
        // console.log(taskData);
        // console.log(err);
        for (let task of taskData) {
            for (let machine of machines) {
                if (task.machine == machine.machineNum) {
                    let dataItem = {
                        task: task.name,
                        machine: machine.machineName,
                        complete: task.complete
                    }
                    sendData.push(dataItem);
                }
            }
        }
        // console.log(sendData);
        res.send(sendData);
    });
});

router.get('/managerAccounts', (req, res) => {
    db.all("SELECT name, type, authorized FROM users WHERE type = 0 OR type = 1", (err, data) => {
        res.send(data);
    })
});

router.get('/managerMachines', (req, res) => {
    let machineList = [];
    for (let machine of machines) {
        let machineItem = {
            machineNum: machine.machineNum,
            machineName: machine.machineName,
            machineStatus: machine.machineStatus,
            machineIp: machine.machineIp
        }
        machineList.push(machineItem);
    }
    res.send(machineList);
});

const listServer = new WebSocketServer({           //与客户端通信，展示机床列表
    perMessageDeflate: false,
    host: aimHost,
    port: 3010
});

listServer.on('connection', (ws) => {
    console.log("listPage connected");
    // ws.send(JSON.stringify(machineList));
    let wsInterval = '';
    // let dbInterval = '';
    // dbInterval = setInterval(() => {
    // });
    wsInterval = setInterval(() => {
        let machineList = [];
        // for (let i = 0; i < machines.length; i++) {
        for (let machine of machines) {              //当前服务器中存在machines的数组
            let machineItem = {
                machineNum: machine.machineNum,
                machineName: machine.machineName,
                machineStatus: machine.machineStatus,
                machineIp: machine.machineIp
            }
            machineList.push(machineItem);
        }
        // }
        // console.log('interval');
        ws.send(JSON.stringify(machineList));
    }, 1000);
    ws.onclose = () => {
        clearInterval(wsInterval);
        console.log('listPage disconnected');
        //   ws.close();     //不能close
    };
    ws.onerror = () => {
        clearInterval(wsInterval);
        console.error('listPage error');
        //   ws.close();
    };
});

const detailServer = new WebSocketServer({         //与客户端通信，展示机床详细信息
    perMessageDeflate: false,
    host: aimHost,
    port: 3020
});

detailServer.on('connection', (ws) => {
    console.log("detailPage connected");
    let machineDetailA = [];
    let machineDetailB = [];
    let request = {};
    let machineTask = {};
    let machineInfo = {};
    ws.on('message', message =>{
        request = JSON.parse(message);
    });
    let wsInterval = '';
    wsInterval = setInterval(() => {
        for(let machine of machines){
            db.get("SELECT * FROM machines WHERE num = '" + request.num + "' ", (err, detail) => {
                    machineInfo = detail;
                }); 
            if(machine.machineStatus == 2 || machine.machineStatus == 3 || machine.machineStatus == 4){
                db.get("SELECT * FROM tasks WHERE machine = '" + request.num + "' AND complete = '" + "false" + "' ", (err, task) => {
                    if(task){
                        machineTask = task;
                    }else{
                        machineTask = {
                            name: ''
                        }
                    }
                });          
            }
            if(machine.machineNum == request.num){
                if(request.tab == 'status'){
                    machineDetailA = {
                        tab: 'status',
                        machineInfo: machineInfo,
                        machineTask: machineTask,

                        machineStatus: machine.machineStatus,
                        coordinate0: machine.coordinate0,
                        coordinate1: machine.coordinate1,
                        coordinate2: machine.coordinate2,
                        coordinate3: machine.coordinate3,

                        cutSpeed: machine.cutSpeed,
                        processTime0: machine.processTime0,
                        processTime1: machine.processTime1,
                        processTime2: machine.processTime2,
                        remainTime0: machine.remainTime0,
                        remainTime1: machine.remainTime1,
                        remainTime2: machine.remainTime2,

                        wireBreak: machine.wireBreak,
                        circuirShort: machine.circuirShort,
                        fluidFail: machine.fluidFail,
                        powerFail: machine.powerFail
                    }
                    // console.log(machineDetailA);
                    ws.send(JSON.stringify(machineDetailA));
                }
                if(request.tab == 'parameter'){
                    machineDetailB = {
                        tab: 'parameter',
                        dischargePermit: machine.dischargePermit,
                        feedPermit: machine.feedPermit,
                        wirePermit: machine.wirePermit,
                        fluidPermit: machine.fluidPermit,
                        pulseWidth: machine.pulseWidth,
                        pulseInterval: machine.pulseInterval,
                        peakCurrent: machine.peakCurrent,
                        openCircuitVoltage: machine.openCircuitVoltage,
                        wireSpeed: machine.wireSpeed,
                        followGap: machine.followGap
                    }
                    ws.send(JSON.stringify(machineDetailB));
                }
            }
        }       
    },1000);
    ws.onclose = () => {
      clearInterval(wsInterval);
      console.log('detailPage disconnected');
    //   ws.close();
    };
    ws.onerror = () => {
      clearInterval(wsInterval);
      console.error('detailPage error');
    //   ws.close();
    };
});

const updateServer = new WebSocketServer({         //与上位机通信，获取状态和参数信息
    perMessageDeflate: false,
    host: aimHost,
    port:4000
});
updateServer.on('connection', (ws) => {
    console.log('machine-server connected.');
    ws.on('message', (message) => {
        let data = JSON.parse(message);
        // console.log(data.taskComplete);
        if(data.taskComplete){
            let workTime = (data.accuTime/3600.0).toFixed(2);
            db.run("UPDATE tasks SET complete = '" + 'true' + "' , time = '" + workTime + "' WHERE num = '" + data.taskNum + "' ");
        }  
        // console.log(data.taskNum);
        for( let machine of machines){
            if(machine.machineNum == data.machineNum){
                machine.machineStatus = data.machineStatus;
                machine.processTime0 = Math.floor(data.accuTime/3600);
                machine.processTime1 = Math.floor(data.accuTime/60 - machine.processTime0 * 60);
                machine.processTime2 = Math.floor(data.accuTime - machine.processTime0 * 3600 -machine.processTime1 * 60);
                machine.remainTime0 = Math.floor((data.workTime-data.accuTime)/3600);
                machine.remainTime1 = Math.floor((data.workTime-data.accuTime)/60 - machine.remainTime0 * 60);
                machine.remainTime2 = Math.floor((data.workTime-data.accuTime) - machine.remainTime0 * 3600 -machine.remainTime1 * 60);

                machine.coordinate0 = data.coordinate0;
                machine.coordinate1 = data.coordinate1;
                machine.coordinate2 = data.coordinate2;
                machine.coordinate3 = data.coordinate3;

                machine.pulseWidth = data.pulseWidth;
                machine.pulseInterval = data.pulseInterval;
                machine.peakCurrent = data.peakCurrent;
                machine.openCircuitVoltage = data.openCircuitVoltage;
                machine.wireSpeed = data.wireSpeed;
                machine.followGap = data.followGap;
                machine.cutSpeed = data.cutSpeed;

                machine.wireBreak = data.wireBreak;
                machine.circuirShort = data.circuirShort;
                machine.fluidFail = data.fluidFail;
                machine.powerFail = data.powerFail;

                machine.dischargePermit = data.dischargePermit;
                machine.feedPermit = data.feedPermit;
                machine.wirePermit = data.wirePermit;
                machine.fluidPermit = data.fluidPermit;
            }
        }
    });
});

module.exports = router;


//-------------------------主服务器程序到此为止---------------------------

// let tim = {
//         machineName: "Tim",
//         machineStatus: 2,
//         machineIp: "192.168.0.1",
//         coordinate0: 20.0,
//         coordinate1: 10.0,
//         coordinate2: 20.0,
//         coordinate3: 10.0,
//         cutSpeed: 10,
//         processTime0: 1,
//         processTime1: 12,
//         processTime2: 35,
//         remainTime0: 0,
//         remainTime1: 27,
//         remainTime2: 25,

//         pulseWidth: 7,
//         pulseInterval: 20,
//         peakCurrent: 10,
//         openCircuitVoltage: 80,
//         wireSpeed: 1,
//         followGap: 0.15,

//         taskName: "cutting",
//         wireDiameter: 0.6,
//         partMaterial: "stell",
//         partThickness: 22,
//         cutFluid: "emulsion",

//         wireBreak: false,
//         circuirShort: false,
//         fluidFail: true,
//         powerFail: false,

//         dischargePermit: true,
//         feedPermit: true,
//         wirePermit: true,
//         fluidPermit: false
//     };

// let john = {
//         machineName: "John",
//         machineStatus: 2,
//         machineIp: "192.168.0.2",
//         coordinate0: 20.0,
//         coordinate1: 10.0,
//         coordinate2: 20.0,
//         coordinate3: 10.0,
//         cutSpeed: 10,
//         processTime0: 1,
//         processTime1: 12,
//         processTime2: 35,
//         remainTime0: 0,
//         remainTime1: 27,
//         remainTime2: 25,

//         pulseWidth: 7,
//         pulseInterval: 20,
//         peakCurrent: 10,
//         openCircuitVoltage: 80,
//         wireSpeed: 1,
//         followGap: 0.15,

//         taskName: "cuttingjohn",
//         wireDiameter: 0.6,
//         partMaterial: "stell",
//         partThickness: 22,
//         cutFluid: "emulsion",

//         wireBreak: false,
//         circuirShort: false,
//         fluidFail: true,
//         powerFail: false,

//         dischargePermit: true,
//         feedPermit: false,
//         wirePermit: true,
//         fluidPermit: false
//     };

// let machines = [tim, john];



// exports.info = function(req, res){
//     var device = {
//         machineName: "Simon",
//         machineName: "Simon",
//         machineStatus: 2,
//         coordinate0: 20.0,
//         coordinate1: 10.0,
//         coordinate2: 20.0,
//         coordinate3: 10.0,
//         cutSpeed: 10,
//         processTime0: 1,
//         processTime1: 12,
//         processTime2: 35,
//         remainTime0: 0,
//         remainTime1: 27,
//         remainTime2: 25,

//         pulseWidth: 7,
//         pulseInterval: 20,
//         peakCurrent: 10,
//         openCircuitVoltage: 80,
//         wireSpeed: 1,
//         followGap: 0.15,

//         taskName: "cutting",
//         wireDiameter: 0.6,
//         partMaterial: "stell",
//         partThickness: 22,
//         cutFluid: "emulsion",

//         wireBreak: true,
//         circuirShort: true,
//         fluidFail: true,
//         powerFail: true,

//         dischargePermit: true,
//         feedPermit: true,
//         wirePermit: true,
//         fluidPermit: true
//     };

    // var devices = [];
    // devices[0].machineName = "Simon";
    // devices[0].machineStatus = 2;
    // devices[0].coordinate[0] = 20.0;
    // devices[0].coordinate[1] = 10.0;
    // devices[0].coordinate[2] = 20.0;
    // devices[0].coordinate[3] = 10.0;
    // devices[0].cutSpeed = 10;
    // devices[0].processTime[0] = 1;
    // devices[0].processTime[1] = 12;
    // devices[0].processTime[2] = 35;
    // devices[0].remainTime[0] = 0;
    // devices[0].remainTime[1] = 27;
    // devices[0].remainTime[2] = 25;

    // devices[0].pulseWidth = 7;
    // devices[0].pulseInterval = 20;
    // devices[0].peakCurrent = 10;
    // devices[0].openCircuitVoltage = 80;
    // devices[0].wireSpeed = 1;
    // devices[0].followGap = 0.15;

    // devices[0].taskName = "cutting";
    // devices[0].wireDiameter = 0.6;
    // devices[0].partMaterial = "stell";
    // devices[0].partThickness = 22;
    // devices[0].cutFluid = "emulsion";

    // devices[0].wireBreak = true;
    // devices[0].circuirShort = true;
    // devices[0].fluidFail = true;
    // devices[0].powerFail = true;

    // devices[0].dischargePermit = true;
    // devices[0].feedPermit = true;
    // devices[0].wirePermit = true;
    // devices[0].fluidPermit = true;

//     res.send(JSON.stringify(device));
// }

// exports.about = function(req, res){
//     res.send("Next to meet you.This is the about page.")
// }

