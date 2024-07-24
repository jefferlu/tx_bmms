import * as path from 'path';
import {
    AuthenticationClient,
    DataManagementClient,
    ModelDerivativeClient,
    DesignAutomationClient,
    WebhooksClient,
    BIM360Client,
    IBucket,
    IObject,
    urnify
} from 'aps-sdk-node';
import { IDerivative } from './interfaces/model-derivative';
import { IAuthOptions } from 'aps-sdk-node/dist/common';
import { IEnvironment } from './environments';
import { ModelDerivativeFormats, isViewableFormat } from './providers/model-derivative';

export interface IPreviewSettings {
    extensions: string[];
    env?: string;
    api?: string;
}

export interface IContext {
    credentials?: IAuthOptions;
    environment?: IEnvironment;
    authenticationClient?: AuthenticationClient;
    dataManagementClient?: DataManagementClient;
    modelDerivativeClient2L?: ModelDerivativeClient; // client for 2-legged workflows
    modelDerivativeClient3L?: ModelDerivativeClient; // client for 3-legged workflows
    designAutomationClient?: DesignAutomationClient;
    webhookClient?: WebhooksClient;
    bim360Client?: BIM360Client;
    threeLeggedToken?: string;
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

export async function promptDerivative(context: IContext, objectId: string): Promise<IDerivative | undefined> {
    const urn = urnify(objectId);
    const manifest = await context.modelDerivativeClient2L.getManifest(urn) as any;
    const svf = manifest.derivatives.find((deriv: any) => isViewableFormat(deriv.outputType));

    if (!svf) {
        return undefined;
    }
    const derivatives: IDerivative[] = svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
        return {
            urn: urn,
            name: geometry.name,
            role: geometry.role,
            guid: geometry.guid,
            bubble: geometry
        };
    });

    // const derivativeName = undefined;
    // if (!derivativeName) {
    //     return undefined;
    // } else {
    //     return derivatives.find(item => item.name === derivativeName);
    // }
    return derivatives[0];
}

export async function promptCustomDerivative(context: IContext, objectId: string, formats: ModelDerivativeFormats): Promise<IDerivative | undefined> {
    const urn = urnify(objectId);
    const manifest = await context.modelDerivativeClient2L.getManifest(urn) as any;

    const derivatives: IDerivative[] = manifest.derivatives
        .filter((deriv: any) => formats.hasOutput(deriv.outputType))
        .filter((deriv: any) => !isViewableFormat(deriv.outputType))
        .flatMap((deriv: any) => deriv.children.filter((child: any) => child.role === deriv.outputType))
        .map((resource: any) => {
            const fileUrn: string = resource.urn;

            return {
                urn,
                name: path.basename(fileUrn),
                role: resource.role,
                guid: resource.guid,
                format: resource.role,
                bubble: {
                    fileUrn
                }
            }
        });

    const derivativeName = undefined;
    if (!derivativeName) {
        return undefined;
    } else {
        return derivatives.find(item => item.name === derivativeName);
    }
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

    if (err.response) {
        const raw = {
            config: err.response.config,
            data: err.response.data,
            headers: err.response.headers,
            status: err.response.status,
            statusText: err.response.statusText
        };

    }

}

export function stringPropertySorter<T>(propName: keyof T) {
    return function (a: T, b: T): number {
        if (a[propName] < b[propName]) { return -1; }
        else if (a[propName] > b[propName]) { return +1; }
        else { return 0; }
    };
}

export function inHubs(urn: string): boolean {
    return urn.indexOf('_') !== -1;
}

