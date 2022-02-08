
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
                node.unsealkeys = RED.util.evaluateNodeProperty(config.unsealkeys, config.unsealkeystype, node, msg);
                node.raftjoin = RED.util.evaluateNodeProperty(config.raftjoin, config.raftjointype, node, msg);

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
        let vaultConfig = getConfig(RED.nodes.getNode(config), node, msg, RED)
        var options = {
            apiVersion: 'v1', // default
            endpoint: vaultConfig.endpoint,
            token: vaultConfig.configtoken
        };

        // get new instance of the client
        let vault = nodeVault(options);
        let payload = { keys: null, token: null, initialized: false };
        try {
            if (!vaultConfig.action || vaultConfig.action === 'status') {
                payload = await vault.status();
            }
            else if (vaultConfig.action === 'init') {

                try {
                    const result = await vault.init(vaultConfig.initOptions);

                    payload.keys = result.keys;
                    payload.token = result.root_token;
                    node.status({ shape: 'dot', fill: 'green', text: `${vaultConfig.endpoint} created` })
                } catch (err) {
                    payload = await vault.status();
                    node.status({ shape: 'dot', fill: 'yellow', text: `${vaultConfig.endpoint} already initialized` })       
                }
            }
            else if (vaultConfig.action === 'unseal') {

                const result = await vault.unseal({ secret_shares: 1, key: vaultConfig.unsealkeys[0] })
                node.status({ shape: 'dot', fill: 'green', text: `${result} unsealed` })
                payload = result;
            }
            else if (vaultConfig.action === 'raftJoin') {
                const result = await vault.raftJoin(vaultConfig.raftJoin)
                node.status({ shape: 'dot', fill: 'green', text: `${result} unsealed` })
                payload = result;
            }


            let newMsg = Object.assign(RED.util.cloneMessage(msg), {
                payload: payload
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

    RED.nodes.registerType("vault-server", engineNode);
}