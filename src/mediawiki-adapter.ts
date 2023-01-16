import { mwn } from "mwn";
export const sizeLimit:number = 256*1024 // arbitrarily set to 256KB 

export interface AudioInfo
{
    size: number
    url: string
    mediatype: string
}

interface QueryResult
{
    query: {
        pages: {
            missing: boolean
            imageinfo: AudioInfo[]
        }[]
    }
}
export async function searchMediaWikiAudioFile(domainApiUrl:string, filename: string) {
    if (!domainApiUrl)
        return null;
    const bot = new mwn({ // constructing this way allows sending requests without login
        apiUrl: domainApiUrl,
        silent: false,      // suppress messages (except error messages)
        retryPause: 1000,   // pause for 5000 milliseconds (5 seconds) on maxlag error.
        maxRetries: 1       // attempt to retry a failing requests upto 3 times
    });
    const data = await bot.request({
        action: 'query',
        prop: 'imageinfo',
        titles: `File:${filename}.mp3`,
        iiprop: 'url|size|mediatype',
        format: 'json'
    }) as QueryResult;
    const firstPage = (data.query?.pages || []).find(page => !page?.missing)
    if (firstPage?.imageinfo[0]?.mediatype === "AUDIO" && firstPage.imageinfo[0].size < sizeLimit) {
        return firstPage.imageinfo[0].url;
    }
    return null;
}