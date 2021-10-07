
import { NodeMessageInFlow, NodeMessage } from "node-red";
import { getConfig, getFiles, mergeDeep } from "./helper";
const fs = require('fs');
const path = require('path');
var nodeVault = require("@naimo84/node-vault")
var CryptoJS = require("crypto-js");

module.exports = function (RED: any) {

    RED.httpAdmin.get("/vaultbackups/:id", async (req, res) => {
        var node = RED.nodes.getNode(req.params.id);
        let files = await getFiles(node.backupfolder);
        let filesnames = []
        for (let file of files) {
            filesnames.push(path.basename(file))
        }
        res.json(filesnames);

    });

    function backupNode(config: any) {
        RED.nodes.createNode(this, config);
        let node = this;
        node.name = config.name;
        node.decodesecret = config.decodesecret;
        node.backup = config.backup;
        node.backupfolder = config.backupfolder;
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
        let payload = [];

        try {
            if (!vaultConfig.action || vaultConfig.action === 'backup') {
                let response = await vault.mounts()
                let mounts = response.data;
                for (let mount of Object.keys(mounts)) {

                    vault.noCustomHTTPVerbs = true;
                    mount = mount.replace('/', '')
                    if (['cubbyhole', 'identity', 'sys'].indexOf(mount) < 0) {
                        let response = await vault.list(`${mount}/metadata`);
                        let keys = response.data.keys;
                        let payloadKeys = [];
                        
                        for (let key of keys) {
                            let response2 = await vault.read(`${mount}/data/${key}`)
                            payloadKeys.push({
                                data: response2.data?.data ? response2.data.data : response2.data,
                                key: key
                            })
                        }
                        payload.push({
                            mount: mount,
                            data: payloadKeys
                        })
                    }
                }
                let encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), vaultConfig.decodesecret)
                payload = encrypted.toString();
                fs.promises.mkdir(`${node.backupfolder}`, { recursive: true }).catch(console.error).then(() => {
                    fs.writeFileSync(`${node.backupfolder}/` + new Date().toISOString(), payload)
                });
            } else if (vaultConfig.action === 'restore') {
                let data = fs.readFileSync(`${node.backupfolder}/${node.backup}`)
                var decrypted = CryptoJS.AES.decrypt(data.toString(), vaultConfig.decodesecret);
                let backupMounts = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
                for (let mount of backupMounts) {
                    let mounts = {}
                    try {
                        mounts = await vault.mounts()
                    } catch { }
                    let exists = Object.keys(mounts).some((item, idx) => {
                        if (item.replace('/', '') === mount.mount) {
                            return true;
                        }
                    })

                    if (!exists) {
                        await vault.mount({
                            mount_point: mount.mount,
                            "config": {
                                "default_lease_ttl": 0,
                                "force_no_cache": false,
                                "max_lease_ttl": 0
                            },
                            "options": {
                                "version": "2"
                            },
                            "seal_wrap": false,
                            "type": "kv"
                        })
                    }
                    setTimeout(async () => {
                        for (let mountdata of mount.data) {
                            let newdata = mountdata.data;
                            try {
                                let response = await vault.read(`${mount.mount}/data/${mountdata.key}`);
                                if (response?.data?.data)
                                    newdata = mergeDeep(response.data.data, mountdata.data);
                            }
                            catch { }
                            await vault.write(`${mount.mount}/data/${mountdata.key}`, { data: newdata });
                            //console.log(newdata);

                        }
                    }, 3000);

                }
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

    RED.nodes.registerType("vault-backup", backupNode);
}