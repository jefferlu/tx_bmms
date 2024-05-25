import { AuthenticationClient, BIM360Client, DataManagementClient, DesignAutomationClient, IBucket, IObject, ModelDerivativeClient, WebhooksClient, urnify } from "forge-server-utils";
import { IAuthOptions } from "forge-server-utils/dist/common";
import { IEnvironment } from "./environments";

export interface IPreviewSettings {
    extensions: string[];
    env?: string;
    api?: string;
}

export interface IContext {
    credentials: IAuthOptions;
    environment: IEnvironment;
    authenticationClient: AuthenticationClient;
    dataManagementClient: DataManagementClient;
    modelDerivativeClient2L: ModelDerivativeClient; // client for 2-legged workflows
    modelDerivativeClient3L: ModelDerivativeClient; // client for 3-legged workflows
    webhookClient: WebhooksClient;
    bim360Client: BIM360Client;
    threeLeggedToken?: string;
}

export async function showErrorMessage(title: string, err: any) {
    let msg = title;
    if (typeof err === 'string') {
        msg += ': ' + err;
    } else if (typeof err === 'object') {
        if (err.message) {
            msg += ': ' + err.message;
        }
    }

    return msg;

    // if (err.response) {
    //     const answer = await vscode.window.showErrorMessage(msg, 'Show Details');
    //     if (answer === 'Show Details') {
    //         const raw = {
    //             config: err.response.config,
    //             data: err.response.data,
    //             headers: err.response.headers,
    //             status: err.response.status,
    //             statusText: err.response.statusText
    //         };
    //         const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(raw, null, 4), language: 'json' });
    //         await vscode.window.showTextDocument(doc, { preview: false });
    //     }
    // } else {
    //     await vscode.window.showErrorMessage(msg);
    // }
}

export async function promptBucket(context: IContext, bucketKey?: string): Promise<IBucket | undefined> {
    const buckets = await context.dataManagementClient.listBuckets();
    if (!bucketKey) {
        return undefined;
    } else {
        return buckets.find(item => item.bucketKey === bucketKey);
    }
}

export async function promptObject(context: IContext, bucketKey: string, objectKey?: string): Promise<any> {
    const objects = await context.dataManagementClient.listObjects(bucketKey);
    if (!objectKey) {
        return objects;
    } else {
        return objects.find(item => item.objectKey === objectKey);
    }
}

export function getURN(object: IObject): string {
    return urnify(object.objectId).replace('/', '_');
}

export function getModelDerivativeClientForObject(object: IObject, context: IContext): ModelDerivativeClient {
    if ('objectId' in object) { //IObject
        return context.modelDerivativeClient2L;
    }
}

export async function promptDerivative(context: IContext, objectId: string): Promise<any | undefined> {
    
    const urn = urnify(objectId);
    const manifest = await context.modelDerivativeClient2L.getManifest(urn) as any;
    const svf = manifest.derivatives.find((deriv: any) => deriv.outputType === 'svf');
    console.log(manifest.derivatives)
    if (!svf) {
        return undefined;
    }
    const derivatives: any[] = svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
        return {
            urn: urn,
            name: geometry.name,
            role: geometry.role,
            guid: geometry.guid,
            bubble: geometry
        };
    });
    console.log(derivatives)
    const derivativeName = 'Scene'

    // if (!derivativeName) {
    //     return undefined;
    // } else {
    // return derivatives.find(item => item.name === derivativeName);
    return derivatives[0];
    // }
}

export function findViewable(derivative: any): any {
    return derivative.bubble.children.find((child: any) => child.role === 'graphics' || child.role === 'pdf-page');
}

