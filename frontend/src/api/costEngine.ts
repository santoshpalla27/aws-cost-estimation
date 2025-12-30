import apiClient from './client';
import type {
    EstimateResponse,
    DiffResponse,
    PolicyResponse,
    UploadConfig,
} from '../types/api';

/**
 * Upload project ZIP and get cost estimate
 */
export async function uploadProject(
    zipBlob: Blob,
    config: UploadConfig,
    onProgress?: (progress: number) => void
): Promise<EstimateResponse> {
    const formData = new FormData();
    formData.append('project_zip', zipBlob, 'project.zip');
    formData.append('evaluation_mode', config.evaluation_mode);

    const response = await apiClient.post<EstimateResponse>('/api/estimate', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                onProgress?.(progress);
            }
        },
    });

    return response.data;
}

/**
 * Calculate diff between two projects
 */
export async function calculateDiff(
    beforeZip: Blob,
    afterZip: Blob,
    onProgress?: (progress: number) => void
): Promise<DiffResponse> {
    const formData = new FormData();
    formData.append('before_zip', beforeZip, 'before.zip');
    formData.append('after_zip', afterZip, 'after.zip');

    const response = await apiClient.post<DiffResponse>('/api/diff', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                onProgress?.(progress);
            }
        },
    });

    return response.data;
}

/**
 * Evaluate policy constraints
 */
export async function evaluatePolicy(
    projectZip: Blob,
    policyFile: Blob,
    onProgress?: (progress: number) => void
): Promise<PolicyResponse> {
    const formData = new FormData();
    formData.append('project_zip', projectZip, 'project.zip');
    formData.append('policy_file', policyFile, 'policy.json');

    const response = await apiClient.post<PolicyResponse>('/api/policy', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                onProgress?.(progress);
            }
        },
    });

    return response.data;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string }> {
    const response = await apiClient.get('/health');
    return response.data;
}
