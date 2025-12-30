import JSZip from 'jszip';

export interface FileWithPath extends File {
    webkitRelativePath?: string;
}

/**
 * Build ZIP from files while preserving directory structure
 * CRITICAL: No modification, no flattening, byte-for-byte preservation
 */
export async function buildProjectZip(
    files: FileWithPath[],
    excludeTerraformDir: boolean = true
): Promise<Blob> {
    const zip = new JSZip();

    for (const file of files) {
        // Get file path (preserve directory structure)
        const path = file.webkitRelativePath || file.name;

        // Optionally exclude .terraform/ directory
        if (excludeTerraformDir && path.includes('.terraform/')) {
            continue;
        }

        // Add file to ZIP with EXACT path preservation
        zip.file(path, file);
    }

    // Generate ZIP blob
    return await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 6, // Balance between size and speed
        },
    });
}

/**
 * Extract file list from ZIP for preview
 * Does NOT modify the ZIP - only reads structure
 */
export async function extractZipFileList(zipBlob: Blob): Promise<string[]> {
    const zip = await JSZip.loadAsync(zipBlob);
    const files: string[] = [];

    zip.forEach((relativePath, file) => {
        if (!file.dir) {
            files.push(relativePath);
        }
    });

    return files.sort();
}

/**
 * Get total size of files
 */
export function getTotalSize(files: File[]): number {
    return files.reduce((total, file) => total + file.size, 0);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
