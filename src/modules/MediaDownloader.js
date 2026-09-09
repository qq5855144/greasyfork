import { Downloader } from './Downloader.js';

class MediaDownloaderService {
    async download(item) {
        return Downloader.downloadImage(item, item.originalName || item.name, item.originalFormat || item.format);
    }
    async downloadMultiple(items) {
        return Downloader.downloadMultipleImages(items);
    }
}
export const MediaDownloader = new MediaDownloaderService();
