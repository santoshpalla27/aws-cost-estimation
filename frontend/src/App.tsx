import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { CostEstimate } from './types/cost';
import { CostSummary } from './components/CostSummary';
import { ServiceBreakdown } from './components/ServiceBreakdown';
import { ResourceTable } from './components/ResourceTable';
import { Assumptions } from './components/Assumptions';

const AWS_REGIONS = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-west-2', label: 'Europe (London)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

function App() {
    const [region, setRegion] = useState('us-east-1');
    const [estimate, setEstimate] = useState<CostEstimate | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const submitEstimate = async (files: File[]) => {
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('region', region);

            // Check if we need to create a ZIP
            if (files.length === 1 && files[0].name.endsWith('.zip')) {
                formData.append('terraform', files[0]);
                setFileName(files[0].name);
            } else if (files.length === 1 && files[0].name.endsWith('.tf')) {
                // Single .tf file - send as-is
                formData.append('terraform', files[0]);
                setFileName(files[0].name);
            } else {
                // Multiple files - create a ZIP
                const zip = new JSZip();
                for (const file of files) {
                    const content = await file.text();
                    zip.file(file.name, content);
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                formData.append('terraform', zipBlob, 'terraform.zip');
                setFileName(`${files.length} files`);
            }

            const response = await fetch('/api/v1/estimate/terraform', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to estimate costs');
            }

            const result: CostEstimate = await response.json();
            setEstimate(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            submitEstimate(acceptedFiles);
        }
    }, [region]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/zip': ['.zip'],
            'text/plain': ['.tf'],
        },
    });

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <div className="logo">
                        <div className="logo-icon">$</div>
                        AWS Cost Estimator
                    </div>
                    <div className="region-selector">
                        <label htmlFor="region">Region:</label>
                        <select
                            id="region"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                        >
                            {AWS_REGIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <main className="main">
                <section className="upload-section">
                    <div
                        {...getRootProps()}
                        className={`dropzone ${isDragActive ? 'active' : ''}`}
                    >
                        <input {...getInputProps()} />
                        <div className="dropzone-icon">📁</div>
                        <h3>
                            {isDragActive
                                ? 'Drop your Terraform files here'
                                : 'Drag & drop Terraform files or click to browse'}
                        </h3>
                        <p>Supports .tf files, folders, or .zip archives</p>
                        {fileName && !loading && (
                            <p style={{ marginTop: '1rem', color: 'var(--accent-primary)' }}>
                                Last uploaded: {fileName}
                            </p>
                        )}
                    </div>
                </section>

                {loading && (
                    <div className="loading">
                        <div className="spinner"></div>
                        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                            Analyzing your infrastructure...
                        </p>
                    </div>
                )}

                {error && (
                    <div className="error">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {estimate && !loading && (
                    <div className="results">
                        <CostSummary estimate={estimate} />
                        <ServiceBreakdown services={estimate.by_service} />
                        <ResourceTable resources={estimate.by_resource} />
                        {estimate.assumptions.length > 0 && (
                            <Assumptions items={estimate.assumptions} />
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
