import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, FolderOpen } from 'lucide-react';
import { validateFiles } from '../../utils/fileValidation';
import { useAppStore } from '../../app/store';

export default function UploadZone() {
    const { setFiles, setError, clearError } = useAppStore();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        clearError();

        const validation = validateFiles(acceptedFiles);

        if (!validation.valid) {
            setError(validation.errors.join(', '));
            return;
        }

        if (validation.warnings.length > 0) {
            console.warn('Validation warnings:', validation.warnings);
        }

        setFiles(acceptedFiles);
    }, [setFiles, setError, clearError]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: false,
    });

    return (
        <div
            {...getRootProps()}
            className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-300 hover:border-brand-400'
                }
      `}
        >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center gap-4">
                <div className="flex gap-4">
                    <Upload className="w-12 h-12 text-gray-400" />
                    <FolderOpen className="w-12 h-12 text-gray-400" />
                    <FileText className="w-12 h-12 text-gray-400" />
                </div>

                <div>
                    <p className="text-lg font-semibold text-gray-700">
                        Drop Terraform project here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        or click to select folder, ZIP file, or .tf files
                    </p>
                </div>

                <div className="flex gap-4 mt-2">
                    <label className="btn-primary cursor-pointer">
                        <input
                            type="file"
                            webkitdirectory=""
                            directory=""
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                onDrop(files);
                            }}
                        />
                        Select Folder
                    </label>

                    <label className="btn-secondary cursor-pointer">
                        <input
                            type="file"
                            accept=".zip"
                            className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                onDrop(files);
                            }}
                        />
                        Select ZIP
                    </label>

                    <label className="btn-secondary cursor-pointer">
                        <input
                            type="file"
                            accept=".tf,.tfvars"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                onDrop(files);
                            }}
                        />
                        Select .tf Files
                    </label>
                </div>

                <p className="text-xs text-gray-400 mt-4">
                    Max 500MB • Folder structure preserved • No files modified
                </p>
            </div>
        </div>
    );
}
