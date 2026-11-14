export interface MediaSpecs {
  resolution: string;
  audio: string;
  hdr?: string;
  container: string;
}

export function extractMediaSpecs(filePath?: string, _runtime?: number): MediaSpecs {
  if (!filePath) {
    return {
      resolution: 'HD',
      audio: '5.1 Surround',
      container: 'MP4',
    };
  }

  const lower = filePath.toLowerCase();

  // Resolution
  let resolution = '1080p Full HD';
  if (lower.includes('2160') || lower.includes('4k') || lower.includes('uhd')) {
    resolution = '4K Ultra HD';
  } else if (lower.includes('1080') || lower.includes('fhd')) {
    resolution = '1080p Full HD';
  } else if (lower.includes('720') || lower.includes('hdrip')) {
    resolution = '720p HD';
  } else if (lower.includes('480') || lower.includes('dvd') || lower.includes('sd')) {
    resolution = 'SD';
  }

  // Audio
  let audio = '5.1 Surround';
  if (lower.includes('atmos')) {
    audio = 'Dolby Atmos';
  } else if (lower.includes('truehd') || lower.includes('dts-hd')) {
    audio = 'Dolby TrueHD 7.1';
  } else if (lower.includes('5.1') || lower.includes('ddp') || lower.includes('eac3') || lower.includes('ac3') || lower.includes('dts')) {
    audio = '5.1 Surround';
  } else if (lower.includes('aac') || lower.includes('stereo') || lower.includes('2.0')) {
    audio = 'Stereo';
  }

  // HDR
  let hdr: string | undefined = undefined;
  if (lower.includes('dv') || lower.includes('dovi') || lower.includes('dolby vision')) {
    hdr = 'Vision';
  } else if (lower.includes('hdr') || lower.includes('10bit')) {
    hdr = 'HDR';
  }

  // Container
  let container = 'MKV';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) {
    container = 'MP4';
  } else if (lower.endsWith('.avi')) {
    container = 'AVI';
  } else if (lower.endsWith('.mov')) {
    container = 'MOV';
  }

  return { resolution, audio, hdr, container };
}
