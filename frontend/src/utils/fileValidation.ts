const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB total

const BINARY_EXTENSIONS = [
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.mp4', '.avi', '.mov', '.pdf', '.doc', '.docx',
];

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    fileCount: number;
    totalSize: number;
    hasTerraformFiles: boolean;
}

/**
 * Validate uploaded files
 * ONLY validates structure - does NOT interpret Terraform
 */
export function validateFiles(files: File[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if any files exist
    if (files.length === 0) {
        errors.push('No files selected');
        return {
            valid: false,
            errors,
            warnings,
            fileCount: 0,
            totalSize: 0,
            hasTerraformFiles: false,
        };
    }

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // Check total size
    if (totalSize > MAX_TOTAL_SIZE) {
        errors.push(`Total file size (${formatSize(totalSize)}) exceeds maximum (${formatSize(MAX_TOTAL_SIZE)})`);
    }

    // Check individual file sizes
    const largeFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (largeFiles.length > 0) {
        errors.push(`${largeFiles.length} file(s) exceed maximum size of ${formatSize(MAX_FILE_SIZE)}`);
    }

    // Check for binary files
    const binaryFiles = files.filter(f => isBinaryFile(f.name));
    if (binaryFiles.length > 0) {
        warnings.push(`${binaryFiles.length} binary file(s) detected - may not be needed for Terraform`);
    }

    // Check for Terraform files
    const terraformFiles = files.filter(f => f.name.endsWith('.tf') || f.name.endsWith('.tfvars'));
    const hasTerraformFiles = terraformFiles.length > 0;

    if (!hasTerraformFiles) {
        errors.push('No .tf files found - Terraform project required');
    }

    // Check for .terraform directory
    const hasTerraformDir = files.some(f => {
        const path = (f as any).webkitRelativePath || f.name;
        return path.includes('.terraform/');
    });

    if (hasTerraformDir) {
        warnings.push('.terraform/ directory detected - consider excluding for faster upload');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        fileCount: files.length,
        totalSize,
        hasTerraformFiles,
    };
}

function isBinaryFile(filename: string): boolean {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return BINARY_EXTENSIONS.includes(ext);
}

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
