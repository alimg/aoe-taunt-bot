import { mwn } from "mwn";
export const sizeLimit:number = 256*1024

export interface AudioInfo
{
    size: number
    url: string
    mediatype: string
}

interface queryResult
{
    query: {
        pages: {
            missing: boolean
            imageinfo: AudioInfo[]
        }[]
    }
}
export async function searchAudioFile(domainApiUrl:string, filename: string) {
    if (!domainApiUrl)
        return null;
    const bot = new mwn({ // constructing this way allows sending requests without login
        apiUrl: domainApiUrl,
        silent: false,      // suppress messages (except error messages)
        retryPause: 5000,   // pause for 5000 milliseconds (5 seconds) on maxlag error.
        maxRetries: 3       // attempt to retry a failing requests upto 3 times
    });
    const data = await bot.request({
        action: 'query',
        prop: 'imageinfo',
        titles: `File:${filename}.mp3`,
        iiprop: 'url|size|mediatype',
        format: 'json'
    }) as queryResult;
    // log.info("retrieved", JSON.stringify(data,undefined, 4));
    const firstPage = (data.query?.pages || []).find(page => !page?.missing)
    if (ret.imageinfo[0]?.mediatype === "AUDIO" && ret.imageinfo[0].size < sizeLimit) {
        return ret.imageinfo[0].url;
    }
    return null;
}