
import { NodeMessageInFlow, NodeMessage } from "node-red";
import { getConfig, mergeDeep, uuidv4 } from "./helper";
var nodeVault = require("node-vault")
import { compile } from "handlebars";


module.exports = function (RED: any) {

    function eventsNode(config: any) {
        RED.nodes.createNode(this, config);
        let node = this;
        node.name = config.name;
        node.application = config.application;
        node.applicationtype = config.applicationtype;
        node.secrettype = config.secrettype;
        node.secret = config.secret;
        node.action = config.action;
        node.data = config.data;
        node.datatype = config.datatype;
        node.status({ text: `` })

        try {

            node.msg = {};
            node.on('input', (msg, send, done) => {
                node.msg = RED.util.cloneMessage(msg);
                send = send || function () { node.send.apply(node, arguments) }
                cronCheckJob(node, msg, send, done, config.confignode);
            });

        }
        catch (err) {
            node.error('Error: ' + err.message);
            node.status({ fill: "red", shape: "ring", text: err.message })
        }
    }

    async function cronCheckJob(node, msg: NodeMessageInFlow, send: (msg: NodeMessage | NodeMessage[]) => void, done: (err?: Error) => void, config) {
        let cloudConfig = getConfig(RED.nodes.getNode(config), node, msg)
        var options = {
            apiVersion: 'v1', // default
            endpoint: cloudConfig.endpoint,
            token: cloudConfig.configtoken
        };

        // get new instance of the client
        let vault = nodeVault(options);
        let payload = {};

        if (cloudConfig.data) {
            const template = compile(JSON.stringify(cloudConfig.data));
            cloudConfig.data = JSON.parse(template({ newSecret: uuidv4() }));
        }
        try {
            if (!cloudConfig.action || cloudConfig.action === 'get') {
                let response = await vault.read(`${cloudConfig.secret}/data/${cloudConfig.application}`)
                payload = response.data?.data ? response.data.data : response.data;
            } else if (cloudConfig.action === 'create') {
                try {
                    let response = await vault.read(`${cloudConfig.secret}/data/${cloudConfig.application}`)
                    payload = response.data?.data ? response.data.data : response.data;
                    node.status({ text: `${cloudConfig.secret}/data/${cloudConfig.application} created` })
                }
                catch {
                    await vault.write(`${cloudConfig.secret}/data/${cloudConfig.application}`, cloudConfig.data)
                    payload = cloudConfig.data?.data ? cloudConfig.data.data : cloudConfig.data;
                    node.status({ text: `${cloudConfig.secret}/data/${cloudConfig.application} already exists` })
                }
            } else if (cloudConfig.action === 'update') {
                let response = await vault.read(`${cloudConfig.secret}/data/${cloudConfig.application}`)
                let data = mergeDeep(response.data, cloudConfig.data);
                await vault.write(`${cloudConfig.secret}/data/${cloudConfig.application}`, data)
                payload = data?.data ? data.data : data;
                node.status({ text: `${cloudConfig.secret}/data/${cloudConfig.application} updated` })

            }

            let newMsg = Object.assign(RED.util.cloneMessage(msg), {
                payload: payload,
                application: cloudConfig.application,
                secret: cloudConfig.secret
            });

            send(newMsg)

            if (done)
                done()
        }
        catch (err) {
            if (done)
                done({ message: 'Error: ' + err.message, name: '' });
            node.status({ fill: "red", shape: "ring", text: err.message })
        }

        setTimeout(() => node.status({ text: `` }), 10000)

    }

    RED.nodes.registerType("vault-get", eventsNode);
}