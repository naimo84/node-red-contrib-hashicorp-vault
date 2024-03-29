
import { NodeMessageInFlow, NodeMessage } from "node-red";
import { getConfig } from "./helper";
var nodeVault = require("@naimo84/node-vault")

module.exports = function (RED: any) {

    function engineNode(config: any) {
        RED.nodes.createNode(this, config);
        let node = this;   
        node.action = config.action;
        node.status({ text: `` })
        try {

            node.msg = {};
            node.on('input', (msg, send, done) => {
                node.msg = RED.util.cloneMessage(msg);
                node.secret = RED.util.evaluateNodeProperty(config.secret, config.secrettype, node, msg);
                node.config = RED.util.evaluateNodeProperty(config.config, config.configtype, node, msg);

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
        let vaultConfig = getConfig(RED.nodes.getNode(config), node, msg,RED)
        var options = {
            apiVersion: 'v1', // default
            endpoint: vaultConfig.endpoint,
            token: vaultConfig.configtoken
        };

        // get new instance of the client
        let vault = nodeVault(options);
        let payload = {
            created: false
        };
        try {
            if (!vaultConfig.action || vaultConfig.action === 'get') {
                let response = await vault.mounts()
                payload = response.data;
            } else if (vaultConfig.action === 'create') {
                let mounts = {}
                try {
                    mounts = await vault.mounts()
                } catch { }
                let exists = Object.keys(mounts).some((item, idx) => {
                    if (item.replace('/', '') === vaultConfig.secret) {
                        return true;
                    }
                })

                if (!exists) {
                    if (vaultConfig.secret) {
                        vaultConfig.config.mount_point = vaultConfig.secret;
                    }
                    await vault.mount(vaultConfig.config)
                    payload = Object.assign(vaultConfig.config, {
                        created: true
                    })
                    node.status({  shape: 'dot', fill: 'green', text: `${vaultConfig.secret} created` })

                }else{
                    node.status({ shape: 'dot', fill: 'yellow',  text: `${vaultConfig.secret} already exists` })

                }
            }

            let newMsg = Object.assign(RED.util.cloneMessage(msg), {
                payload: payload,                
                secret: vaultConfig.secret
            });

            send(newMsg)
          
            if (done)
                done()
        } catch (err) {
            if (done)
                done({ message: 'Error: ' + err.message, name: '' });
            node.status({ fill: "red", shape: "ring", text: err.message })

        }
        setTimeout(() => node.status({ text: `` }), 10000)

    }

    RED.nodes.registerType("vault-secret-engine", engineNode);
}