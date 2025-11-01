import { OrientationEnum } from "../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";
import https from "https";
import http from "http";
import { createHash } from "crypto";

import { Kokoro } from "./libraries/Kokoro";
import { Remotion } from "./libraries/Remotion";
import { Whisper } from "./libraries/Whisper";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
  MusicForVideo,
} from "../types/shorts";

/**
 * Converts Google Drive view URLs to direct download URLs.
 * Supports formats:
 * - https://drive.google.com/file/d/{FILE_ID}/view
 * - https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
 * - https://drive.google.com/open?id={FILE_ID}
 *
 * Note: For large files, Google Drive may show a virus scan warning.
 * The URL format with 'confirm=t' bypasses this for direct downloads.
 */
function convertGoogleDriveUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Check if it's a Google Drive URL
    if (!urlObj.hostname.includes("drive.google.com")) {
      return url;
    }

    // Extract file ID from various Google Drive URL formats
    let fileId: string | null = null;

    // Format: /file/d/{FILE_ID}/view
    const filePathMatch = urlObj.pathname.match(/\/file\/d\/([^/]+)/);
    if (filePathMatch) {
      fileId = filePathMatch[1];
    }

    // Format: /open?id={FILE_ID}
    if (!fileId && urlObj.searchParams.has("id")) {
      fileId = urlObj.searchParams.get("id");
    }

    if (fileId) {
      // Use the more reliable download URL format that works with larger files
      // 'confirm=t' bypasses the virus scan warning page
      const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
      logger.debug(
        { originalUrl: url, directUrl },
        "Converted Google Drive view URL to direct download URL",
      );
      return directUrl;
    }

    // If we can't parse it, return original URL
    return url;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
  }[] = [];
  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {}

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public addToQueue(sceneInput: SceneInput[], config: RenderConfig): string {
    // todo add mutex lock
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
    });
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { sceneInput, config, id } = this.queue[0];
    logger.debug(
      { sceneInput, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      logger.error(error, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );
    const scenes: Scene[] = [];
    let totalDuration = 0;
    const excludeVideoIds = [];
    const tempFiles = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    let index = 0;
    for (const scene of inputScenes) {
      const audio = await this.kokoro.generate(
        scene.text,
        config.voice ?? "af_heart",
      );
      let { audioLength } = audio;
      const { audio: audioStream } = audio;

      // add the paddingBack in seconds to the last scene
      if (index + 1 === inputScenes.length && config.paddingBack) {
        audioLength += config.paddingBack / 1000;
      }

      const tempId = cuid();
      const tempWavFileName = `${tempId}.wav`;
      const tempMp3FileName = `${tempId}.mp3`;
      const tempVideoFileName = `${tempId}.mp4`;
      const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
      const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
      const tempVideoPath = path.join(
        this.config.tempDirPath,
        tempVideoFileName,
      );
      tempFiles.push(tempVideoPath);
      tempFiles.push(tempWavPath, tempMp3Path);

      await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
      const captions = await this.whisper.CreateCaption(tempWavPath);

      await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
      // Support optional custom video URL per scene (scene.videoUrl). If provided, skip Pexels lookup.
      let videoUrlToDownload: string | null = null;
      let videoIdForExclude: string | undefined;

      if (scene.backgroundVideo?.src) {
        videoUrlToDownload = convertGoogleDriveUrl(scene.backgroundVideo.src);
        // Create a deterministic id/hash for this custom URL so we can still track exclusions
        const hash = createHash("sha256")
          .update(videoUrlToDownload)
          .digest("hex");
        videoIdForExclude = `custom-${hash.substring(0, 12)}`;
      } else {
        const video = await this.pexelsApi.findVideo(
          scene.searchTerms || [],
          audioLength,
          excludeVideoIds,
          orientation,
        );
        videoUrlToDownload = video.url;
        videoIdForExclude = video.id;
      }

      if (!videoUrlToDownload) {
        throw new Error("No video URL available for scene");
      }

      logger.debug(
        `Downloading video from ${videoUrlToDownload} to ${tempVideoPath}`,
      );

      // Caching: compute cache filename from URL hash + extension
      const urlPath = new URL(videoUrlToDownload).pathname;
      const ext = path.extname(urlPath) || ".mp4";
      const urlHash = createHash("sha256")
        .update(videoUrlToDownload)
        .digest("hex");
      const cacheFileName = `${urlHash}${ext}`;
      const cacheFilePath = path.join(
        this.config.videoCacheDirPath,
        cacheFileName,
      );

      // Check if we have a valid cached version
      if (this.validateCachedFile(cacheFilePath)) {
        logger.debug({ cacheFilePath }, "Using cached video file");
        // copy cached file into temp so Remotion can read from /api/tmp
        fs.copyFileSync(cacheFilePath, tempVideoPath);
      } else {
        // download into temp path, then copy to cache atomically
        await new Promise<void>((resolve, reject) => {
          const downloadFile = (url: string, redirectCount = 0) => {
            const MAX_REDIRECTS = 5;

            if (redirectCount > MAX_REDIRECTS) {
              reject(new Error("Too many redirects"));
              return;
            }

            const fileStream = fs.createWriteStream(tempVideoPath);
            const parsedUrl = new URL(url);
            const getter = url.startsWith("https") ? https : http;

            // Prepare request options with headers to mimic a browser
            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port,
              path: parsedUrl.pathname + parsedUrl.search,
              method: "GET",
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "*/*",
                "Accept-Encoding": "identity",
                Connection: "keep-alive",
              },
              timeout: 30000, // 30 second timeout
            };

            const request = getter
              .get(options, (response: http.IncomingMessage) => {
                // Handle redirects (301, 302, 303, 307, 308)
                if (
                  response.statusCode &&
                  response.statusCode >= 300 &&
                  response.statusCode < 400 &&
                  response.headers.location
                ) {
                  logger.debug(
                    {
                      statusCode: response.statusCode,
                      location: response.headers.location,
                    },
                    "Following redirect",
                  );
                  fileStream.close();
                  fs.unlink(tempVideoPath, () => {}); // Clean up partial file
                  downloadFile(response.headers.location, redirectCount + 1);
                  return;
                }

                if (response.statusCode !== 200) {
                  fileStream.close();
                  fs.unlink(tempVideoPath, () => {});
                  reject(
                    new Error(
                      `Failed to download video: ${response.statusCode}`,
                    ),
                  );
                  return;
                }

                response.pipe(fileStream);

                fileStream.on("finish", async () => {
                  fileStream.close();
                  logger.debug(
                    `Video downloaded successfully to ${tempVideoPath}`,
                  );
                  // Atomically write to cache
                  await this.writeToCacheAtomic(tempVideoPath, cacheFilePath);
                  // Evict old cache entries if needed
                  await this.evictCacheIfNeeded();
                  resolve();
                });
              })
              .on("error", (err: Error) => {
                fileStream.close();
                fs.unlink(tempVideoPath, () => {}); // Delete the file if download failed
                logger.error(err, "Error downloading video:");
                reject(err);
              })
              .on("timeout", () => {
                request.destroy();
                fileStream.close();
                fs.unlink(tempVideoPath, () => {});
                reject(
                  new Error("Download request timed out after 30 seconds"),
                );
              });
          };

          downloadFile(videoUrlToDownload!);
        });
      }

      if (videoIdForExclude) {
        excludeVideoIds.push(videoIdForExclude);
      }

      scenes.push({
        captions,
        video: `http://localhost:${this.config.port}/api/tmp/${tempVideoFileName}`,
        backgroundVideo: {
          src: `http://localhost:${this.config.port}/api/tmp/${tempVideoFileName}`,
          loop:
            scene.backgroundVideo?.loop ?? (scene.backgroundVideo?.src ? 1 : 0),
          seek: scene.backgroundVideo?.seek ?? 0,
          resize: scene.backgroundVideo?.resize ?? "cover",
        },
        audio: {
          url: `http://localhost:${this.config.port}/api/tmp/${tempMp3FileName}`,
          duration: audioLength,
        },
      });

      totalDuration += audioLength;
      index++;
    }
    if (config.paddingBack) {
      totalDuration += config.paddingBack / 1000;
    }

    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic }, "Selected music for the video");

    await this.remotion.render(
      {
        music: selectedMusic,
        scenes,
        config: {
          durationMs: totalDuration * 1000,
          paddingBack: config.paddingBack,
          ...{
            captionBackgroundColor: config.captionBackgroundColor,
            captionPosition: config.captionPosition,
          },
          musicVolume: config.musicVolume,
        },
      },
      videoId,
      orientation,
    );

    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    return videoId;
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });
    return musicFiles[Math.floor(Math.random() * musicFiles.length)];
  }

  public ListAvailableMusicTags(): MusicTag[] {
    const tags = new Set<MusicTag>();
    this.musicManager.musicList().forEach((music) => {
      tags.add(music.mood as MusicTag);
    });
    return Array.from(tags.values());
  }

  public listAllVideos(): { id: string; status: VideoStatus }[] {
    const videos: { id: string; status: VideoStatus }[] = [];

    // Check if videos directory exists
    if (!fs.existsSync(this.config.videosDirPath)) {
      return videos;
    }

    // Read all files in the videos directory
    const files = fs.readdirSync(this.config.videosDirPath);

    // Filter for MP4 files and extract video IDs
    for (const file of files) {
      if (file.endsWith(".mp4")) {
        const videoId = file.replace(".mp4", "");

        let status: VideoStatus = "ready";
        const inQueue = this.queue.find((item) => item.id === videoId);
        if (inQueue) {
          status = "processing";
        }

        videos.push({ id: videoId, status });
      }
    }

    // Add videos that are in the queue but not yet rendered
    for (const queueItem of this.queue) {
      const existingVideo = videos.find((v) => v.id === queueItem.id);
      if (!existingVideo) {
        videos.push({ id: queueItem.id, status: "processing" });
      }
    }

    return videos;
  }

  public ListAvailableVoices(): string[] {
    return this.kokoro.listAvailableVoices();
  }

  /**
   * Validate if a cached file exists and has a reasonable size
   */
  private validateCachedFile(cacheFilePath: string): boolean {
    try {
      if (!fs.existsSync(cacheFilePath)) {
        return false;
      }
      const stats = fs.statSync(cacheFilePath);
      // Check if file has some content (at least 1KB)
      if (stats.size < 1024) {
        logger.warn(
          { cacheFilePath, size: stats.size },
          "Cached file is too small, removing",
        );
        fs.removeSync(cacheFilePath);
        return false;
      }
      return true;
    } catch (err) {
      logger.warn({ err, cacheFilePath }, "Error validating cached file");
      return false;
    }
  }

  /**
   * Write file to cache atomically to prevent corruption from concurrent writes
   */
  private async writeToCacheAtomic(
    sourcePath: string,
    cacheFilePath: string,
  ): Promise<void> {
    try {
      // Ensure cache directory exists
      fs.ensureDirSync(this.config.videoCacheDirPath);

      // Write to a temporary file first
      const tempCachePath = `${cacheFilePath}.tmp`;
      fs.copyFileSync(sourcePath, tempCachePath);

      // Atomically rename to final location
      fs.renameSync(tempCachePath, cacheFilePath);
      logger.debug({ cacheFilePath }, "Cached downloaded video");
    } catch (err) {
      logger.warn({ err, cacheFilePath }, "Failed to write cache file");
      // Clean up temp file if it exists
      try {
        const tempCachePath = `${cacheFilePath}.tmp`;
        if (fs.existsSync(tempCachePath)) {
          fs.removeSync(tempCachePath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Evict old cache entries if cache size exceeds limit
   */
  private async evictCacheIfNeeded(): Promise<void> {
    if (!this.config.videoCacheSizeInBytes) {
      return; // No limit set
    }

    try {
      // Ensure cache directory exists
      if (!fs.existsSync(this.config.videoCacheDirPath)) {
        return;
      }

      const cacheFiles = fs.readdirSync(this.config.videoCacheDirPath);
      const fileStats: Array<{ path: string; size: number; mtime: Date }> = [];
      let totalSize = 0;

      for (const file of cacheFiles) {
        // Skip temp files
        if (file.endsWith(".tmp")) {
          continue;
        }

        const filePath = path.join(this.config.videoCacheDirPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            fileStats.push({
              path: filePath,
              size: stats.size,
              mtime: stats.mtime,
            });
            totalSize += stats.size;
          }
        } catch (err) {
          // Skip files we can't stat
          logger.warn({ err, file }, "Error reading cache file stats");
        }
      }

      // If under limit, no eviction needed
      if (totalSize <= this.config.videoCacheSizeInBytes) {
        logger.debug(
          { totalSize, limit: this.config.videoCacheSizeInBytes },
          "Cache within size limit",
        );
        return;
      }

      // Sort by modification time (oldest first) for LRU eviction
      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // Remove oldest files until we're under the limit
      let currentSize = totalSize;
      for (const file of fileStats) {
        if (currentSize <= this.config.videoCacheSizeInBytes) {
          break;
        }

        try {
          fs.removeSync(file.path);
          currentSize -= file.size;
          logger.debug(
            { file: file.path, size: file.size, newTotal: currentSize },
            "Evicted cache file",
          );
        } catch (err) {
          logger.warn({ err, file: file.path }, "Error evicting cache file");
        }
      }
    } catch (err) {
      logger.warn({ err }, "Error during cache eviction");
    }
  }
}
