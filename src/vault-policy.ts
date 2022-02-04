
import { NodeMessageInFlow, NodeMessage } from "node-red";
import { getConfig, mergeDeep, uuidv4 } from "./helper";
var nodeVault = require("@naimo84/node-vault")
import { compile } from "handlebars";


module.exports = function (RED: any) {

    function eventsNode(config: any) {
        RED.nodes.createNode(this, config);
        let node = this;
        node.name = config.name;

        node.action = config.action;
        node.status({ text: `` })

        try {
            node.msg = {};
            node.on('input', (msg, send, done) => {
                node.secret = RED.util.evaluateNodeProperty(config.secret, config.secrettype, node, msg);
                node.application = RED.util.evaluateNodeProperty(config.application, config.applicationtype, node, msg);
                node.data = RED.util.evaluateNodeProperty(config.data, config.datatype, node, msg);
                node.noupdate = config.noupdate;
                node.msg = RED.util.cloneMessage(msg);
                send = send || function () { node.send.apply(node, arguments) }
                processInput(node, msg, send, done, config.confignode);
            });

        }
        catch (err) {
            node.error('Error: ' + err.message);
            node.status({ fill: "red", shape: "ring", text: err.message })
        }
    }

    async function processInput(node, msg: NodeMessageInFlow, send: (msg: NodeMessage | NodeMessage[]) => void, done: (err?: Error) => void, config) {
        let vaultConfig = getConfig(RED.nodes.getNode(config), node, msg)
        var options = {
            apiVersion: 'v1', // default
            endpoint: vaultConfig.endpoint,
            token: vaultConfig.configtoken
        };

        // get new instance of the client
        let vault = nodeVault(options);
        let payload = {};

        if (vaultConfig.data) {
            const template = compile(JSON.stringify(vaultConfig.data));
            vaultConfig.data = JSON.parse(template({ newSecret: uuidv4() }));
        }
        try {
            if (!vaultConfig.action || vaultConfig.action === 'get') {
                let response = await vault.policies()
              
                payload = response.data?.data ? response.data.data : response.data;
            } else if (vaultConfig.action === 'create') {
                let response = await vault.addPolicy({
                    name: vaultConfig.secret,
                    rules: JSON.stringify(vaultConfig.data)
                });
                payload = response.data?.data ? response.data.data : response.data;              
                node.status({ shape: 'dot', fill: 'yellow', text: `${vaultConfig.secret}/data/${vaultConfig.application} already exists` })
            }
            else if (vaultConfig.action === 'write') {
               
                await vault.write(`${vaultConfig.secret}/keys/${vaultConfig.application}`, vaultConfig.data)
            
                node.status({ shape: 'dot', fill: 'green', text: `${vaultConfig.secret}/data/${vaultConfig.application} updated` })

            }

            let newMsg = Object.assign(RED.util.cloneMessage(msg), {
                payload: payload,
                application: vaultConfig.application,
                secret: vaultConfig.secret
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

    RED.nodes.registerType("vault-policy", eventsNode);
}