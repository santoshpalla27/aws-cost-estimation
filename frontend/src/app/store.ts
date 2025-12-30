import { create } from 'zustand';
import type { Estimate, EvaluationMode, DiffResponse, PolicyResponse } from '../types/api';

interface AppState {
    // Upload state
    files: File[] | null;
    zipBlob: Blob | null;
    uploadProgress: number;
    isUploading: boolean;

    // Configuration
    evaluationMode: EvaluationMode;
    excludeTerraformDir: boolean;

    // Result state
    estimate: Estimate | null;
    selectedResourceAddress: string | null;

    // Diff state
    beforeZip: Blob | null;
    afterZip: Blob | null;
    diffResult: DiffResponse | null;

    // Policy state
    policyResults: PolicyResponse | null;

    // Error state
    error: string | null;

    // Actions
    setFiles: (files: File[] | null) => void;
    setZipBlob: (blob: Blob | null) => void;
    setUploadProgress: (progress: number) => void;
    setIsUploading: (isUploading: boolean) => void;
    setEvaluationMode: (mode: EvaluationMode) => void;
    setExcludeTerraformDir: (exclude: boolean) => void;
    setEstimate: (estimate: Estimate | null) => void;
    setSelectedResourceAddress: (address: string | null) => void;
    setBeforeZip: (blob: Blob | null) => void;
    setAfterZip: (blob: Blob | null) => void;
    setDiffResult: (diff: DiffResponse | null) => void;
    setPolicyResults: (results: PolicyResponse | null) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Initial state
    files: null,
    zipBlob: null,
    uploadProgress: 0,
    isUploading: false,
    evaluationMode: 'CONSERVATIVE',
    excludeTerraformDir: true,
    estimate: null,
    selectedResourceAddress: null,
    beforeZip: null,
    afterZip: null,
    diffResult: null,
    policyResults: null,
    error: null,

    // Actions
    setFiles: (files) => set({ files }),
    setZipBlob: (zipBlob) => set({ zipBlob }),
    setUploadProgress: (uploadProgress) => set({ uploadProgress }),
    setIsUploading: (isUploading) => set({ isUploading }),
    setEvaluationMode: (evaluationMode) => set({ evaluationMode }),
    setExcludeTerraformDir: (excludeTerraformDir) => set({ excludeTerraformDir }),
    setEstimate: (estimate) => set({ estimate }),
    setSelectedResourceAddress: (selectedResourceAddress) => set({ selectedResourceAddress }),
    setBeforeZip: (beforeZip) => set({ beforeZip }),
    setAfterZip: (afterZip) => set({ afterZip }),
    setDiffResult: (diffResult) => set({ diffResult }),
    setPolicyResults: (policyResults) => set({ policyResults }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    reset: () => set({
        files: null,
        zipBlob: null,
        uploadProgress: 0,
        isUploading: false,
        estimate: null,
        selectedResourceAddress: null,
        error: null,
    }),
}));
