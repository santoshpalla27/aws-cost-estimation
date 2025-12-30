import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from '../components/UploadZone/UploadZone';
import { useAppStore } from '../app/store';
import { buildProjectZip, formatBytes } from '../utils/zipBuilder';
import { validateFiles } from '../utils/fileValidation';
import { uploadProject } from '../api/costEngine';
import { Loader2, FileCode, Settings, AlertCircle } from 'lucide-react';
import type { EvaluationMode } from '../types/api';

export default function UploadPage() {
    const navigate = useNavigate();
    const {
        files,
        setZipBlob,
        setUploadProgress,
        setIsUploading,
        setEstimate,
        evaluationMode,
        setEvaluationMode,
        excludeTerraformDir,
        setExcludeTerraformDir,
        setError,
        error,
    } = useAppStore();

    const [localError, setLocalError] = useState<string | null>(null);

    const handleUpload = async () => {
        if (!files || files.length === 0) {
            setLocalError('No files selected');
            return;
        }

        setLocalError(null);
        setError(null);
        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Build ZIP
            const zipBlob = await buildProjectZip(files, excludeTerraformDir);
            setZipBlob(zipBlob);

            // Upload to API
            const response = await uploadProject(
                zipBlob,
                { evaluation_mode: evaluationMode, exclude_terraform_dir: excludeTerraformDir },
                (progress) => {
                    setUploadProgress(progress);
                }
            );

            setEstimate(response.estimate);
            navigate('/results');
        } catch (err: any) {
            const errorMessage = err.message || 'Upload failed';
            setError(errorMessage);
            setLocalError(errorMessage);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const validation = files ? validateFiles(files) : null;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        AWS Cost Estimation
                    </h1>
                    <p className="text-gray-600">
                        Upload your Terraform project for accurate cost analysis
                    </p>
                </div>

                {/* Upload Zone */}
                <UploadZone />

                {/* File Info */}
                {files && files.length > 0 && (
                    <div className="mt-6 card">
                        <div className="flex items-start gap-3 mb-4">
                            <FileCode className="w-5 h-5 text-brand-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold">Selected Files</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {files.length} file(s) • {formatBytes(validation?.totalSize || 0)}
                                </p>
                            </div>
                        </div>

                        {/* Validation Messages */}
                        {validation && (
                            <div className="space-y-2">
                                {validation.errors.map((error, idx) => (
                                    <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-red-800">{error}</p>
                                    </div>
                                ))}
                                {validation.warnings.map((warning, idx) => (
                                    <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-yellow-800">{warning}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Configuration */}
                {files && files.length > 0 && validation?.valid && (
                    <div className="mt-6 card">
                        <div className="flex items-center gap-3 mb-4">
                            <Settings className="w-5 h-5 text-gray-600" />
                            <h3 className="font-semibold">Configuration</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Evaluation Mode */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Evaluation Mode
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['STRICT', 'CONSERVATIVE', 'OPTIMISTIC'] as EvaluationMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setEvaluationMode(mode)}
                                            className={`p-3 text-sm rounded-lg border-2 transition-colors ${evaluationMode === mode
                                                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <span className="font-semibold">{mode}</span>
                                            <p className="text-xs mt-1 text-gray-600">
                                                {mode === 'STRICT' && 'Fail on missing'}
                                                {mode === 'CONSERVATIVE' && 'Higher estimates'}
                                                {mode === 'OPTIMISTIC' && 'Lower estimates'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Exclude .terraform */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="exclude-terraform"
                                    checked={excludeTerraformDir}
                                    onChange={(e) => setExcludeTerraformDir(e.target.checked)}
                                    className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                />
                                <label htmlFor="exclude-terraform" className="text-sm text-gray-700">
                                    Exclude .terraform/ directory (recommended)
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {(localError || error) && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-900 font-medium">Error</p>
                        <p className="text-sm text-red-800 mt-1">{localError || error}</p>
                    </div>
                )}

                {/* Upload Button */}
                {files && files.length > 0 && validation?.valid && (
                    <div className="mt-6">
                        <button
                            onClick={handleUpload}
                            disabled={useAppStore.getState().isUploading}
                            className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {useAppStore.getState().isUploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Estimating... {useAppStore.getState().uploadProgress}%
                                </>
                            ) : (
                                <>
                                    Get Cost Estimate
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
