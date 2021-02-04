
import { NodeMessageInFlow, NodeMessage } from "node-red";
import { getConfig } from "./helper";
var nodeVault = require("node-vault")

module.exports = function (RED: any) {

    function engineNode(config: any) {
        RED.nodes.createNode(this, config);
        let node = this;
        node.secret = config.secret;
        node.secrettype = config.secrettype;
        node.config = config.config;
        node.configtype = config.configtype;
        node.action = config.action;
        node.status({ text: `` })
        try {

            node.msg = {};
            node.on('input', (msg, send, done) => {
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
        let payload = {
            created: false
        };
        try {
            if (!vaultConfig.action || vaultConfig.action === 'get') {
                let response = await vault.mounts()
                payload = response.data;
            } else if (vaultConfig.action === 'create') {
                let mounts = await vault.mounts()

                let exists = Object.keys(mounts).some((item, idx) => {
                    if (item.replace('/', '') === (vaultConfig.config as any).mount_point) {
                        return true;
                    }
                })
                if (!exists) {
                    await vault.mount(vaultConfig.config)
                    payload = Object.assign(vaultConfig.config, {
                        created: true
                    })
                }
            }

            send({
                payload: payload,
                //@ts-ignore
                secret: node.secret
            })
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