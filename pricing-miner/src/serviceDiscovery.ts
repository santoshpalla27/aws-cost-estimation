import axios from 'axios';
import { logger } from './logger';

export class ServiceDiscovery {
    private readonly AWS_PRICING_API = 'https://pricing.us-east-1.amazonaws.com';

    /**
     * Discover all available AWS services from the Pricing API
     */
    async discoverAllServices(): Promise<string[]> {
        logger.info('Discovering all AWS services from Pricing API');

        try {
            const response = await axios.get(`${this.AWS_PRICING_API}/offers/v1.0/aws/index.json`);
            
            // The index.json contains all available service codes
            const offers = response.data;
            const serviceCodes: string[] = [];

            // Extract service codes from the offers object
            for (const key in offers) {
                if (key !== 'formatVersion' && key !== 'disclaimer' && key !== 'publicationDate') {
                    serviceCodes.push(key);
                }
            }

            logger.info(`Discovered ${serviceCodes.length} AWS services`);
            return serviceCodes.sort();

        } catch (error: any) {
            logger.error('Failed to discover AWS services', { error: error.message });
            
            // Fallback to predefined list of major services
            logger.warn('Using fallback list of major AWS services');
            return this.getMajorServices();
        }
    }

    /**
     * Get predefined list of major AWS services (fallback)
     */
    getMajorServices(): string[] {
        return [
            // Compute
            'AmazonEC2',
            'AWSLambda',
            'AmazonECS',
            'AmazonEKS',
            'AmazonLightsail',
            'AWSBatch',
            
            // Storage
            'AmazonS3',
            'AmazonEBS',
            'AmazonEFS',
            'AmazonFSx',
            'AmazonGlacier',
            'AWSBackup',
            
            // Database
            'AmazonRDS',
            'AmazonDynamoDB',
            'AmazonElastiCache',
            'AmazonRedshift',
            'AmazonDocumentDB',
            'AmazonNeptune',
            'AmazonDAX',
            'AmazonMemoryDB',
            
            // Networking
            'AmazonVPC',
            'AmazonCloudFront',
            'AmazonRoute53',
            'AWSELB',
            'AmazonAPIGateway',
            'AWSDirectConnect',
            'AWSTransitGateway',
            'AWSPrivateLink',
            
            // Application Integration
            'AmazonSNS',
            'AmazonSQS',
            'AmazonMQ',
            'AmazonEventBridge',
            'AWSStepFunctions',
            'AmazonKinesis',
            
            // Analytics
            'AmazonAthena',
            'AWSGlue',
            'AmazonEMR',
            'AmazonQuickSight',
            'AmazonKinesisAnalytics',
            
            // Security
            'AWSKeyManagementService',
            'AWSSecretsManager',
            'AWSWAF',
            'AWSShield',
            'AWSGuardDuty',
            'AmazonCognito',
            'AWSCertificateManager',
            
            // Developer Tools
            'AWSCodeBuild',
            'AWSCodeDeploy',
            'AWSCodePipeline',
            'AWSCodeCommit',
            'AWSCodeArtifact',
            
            // Management
            'AmazonCloudWatch',
            'AWSCloudTrail',
            'AWSConfig',
            'AWSSystemsManager',
            'AWSServiceCatalog',
            
            // Machine Learning
            'AmazonSageMaker',
            'AmazonRekognition',
            'AmazonComprehend',
            'AmazonTranscribe',
            'AmazonPolly',
            
            // Containers
            'AmazonECR',
            'AWSFargate',
            
            // Migration
            'AWSDataTransfer',
            'AWSSnowball',
            'AWSTransfer',
            
            // Other
            'AmazonSES',
            'AmazonWorkSpaces',
            'AmazonAppStream',
        ].sort();
    }

    /**
     * Get essential services only (for quick setup)
     */
    getEssentialServices(): string[] {
        return [
            'AmazonEC2',
            'AWSLambda',
            'AmazonRDS',
            'AmazonS3',
            'AmazonDynamoDB',
            'AmazonVPC',
            'AWSELB',
            'AmazonCloudFront',
            'AmazonRoute53',
            'AmazonSNS',
        ].sort();
    }
}
