
import { Node } from 'node-red';



export interface IcalNode extends Node {

    config: any;
    red: any;

}

export function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

export function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}

export interface VaultConfig {
    name: string;
    endpoint: string;
    configtoken: string;
    application: string;
    secret: string;
    action: string;
    data: any;
    config: any;
}

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function getConfig(config: any, node?: any, msg?: any): VaultConfig {

    let application = node.application;
    if (node.applicationtype === "msg") {
        for (let key of Object.keys(msg)) {
            if (key === node.application) {
                application = msg[key];
                break;
            }
        }
    }

    let data;
    if (node.datatype === "msg") {
        for (let key of Object.keys(msg)) {
            if (key === node.data) {
                data = msg[key];
                break;
            }
        }
    }else{
        data = (node?.data ? JSON.parse(node?.data) : null)
    }

    const cloudConfig = {
        name: msg?.name || config?.name,
        endpoint: config?.endpoint,
        configtoken: config?.credentials?.configtoken,
        application: application,
        secret: node?.secret,
        action: node?.action || msg?.action,
        data: data,
        config: node?.configtype !== 'json' ? msg?.payload?.config : (node?.config ? JSON.parse(node?.config):null),
    } as VaultConfig;

    switch (node?.secrettype) {
        case 'msg':
            cloudConfig.secret = msg[node.secret]
            break;
        case 'str':
            cloudConfig.secret = JSON.parse(node?.secret)
            break;
        case 'flow':
            cloudConfig.secret = node.context().flow.get(node.secret)
            break;
        case 'global':
            cloudConfig.secret = node.context().global.get(node.secret)
            break;
    }

    return cloudConfig;
}





