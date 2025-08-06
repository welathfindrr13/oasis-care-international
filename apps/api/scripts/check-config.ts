import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as Joi from 'joi';
import * as dotenv from 'dotenv';

// Load environment file
dotenv.config({ path: '.env.development' });

// Configuration validation schema
const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').required(),
  JWT_SECRET: Joi.string().min(32).required(),
  DATABASE_URL: Joi.string().uri().required(),
  PORT: Joi.number().default(3000),
});

// Factory function to load secrets from AWS Secrets Manager
const configFactory = async () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // For local development, use environment variables directly
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return {
      NODE_ENV: nodeEnv,
      JWT_SECRET: process.env.JWT_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
      PORT: parseInt(process.env.PORT || '3000', 10),
    };
  }

  // For production/staging, fetch from AWS Secrets Manager
  const secretsClient = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'eu-west-2',
  });

  try {
    // Fetch JWT secret from Secrets Manager
    const jwtSecretCommand = new GetSecretValueCommand({
      SecretId: 'oasis/jwt-signing-key',
    });
    const jwtSecretResponse = await secretsClient.send(jwtSecretCommand);
    const jwtSecretData = JSON.parse(jwtSecretResponse.SecretString || '{}');

    return {
      NODE_ENV: nodeEnv,
      JWT_SECRET: jwtSecretData.value,
      DATABASE_URL: process.env.DATABASE_URL, // Still from env for now
      PORT: parseInt(process.env.PORT || '3000', 10),
    };
  } catch (error) {
    console.error('Failed to fetch secrets from AWS Secrets Manager:', error);
    throw new Error('Configuration initialization failed');
  }
};

async function checkConfig() {
  try {
    console.log('🔧 Checking configuration...');
    
    // Load configuration
    const config = await configFactory();

    console.log('✅ Configuration loaded successfully:');
    console.log(`   NODE_ENV: ${config.NODE_ENV}`);
    console.log(`   JWT_SECRET: ${config.JWT_SECRET ? `[PRESENT - ${config.JWT_SECRET.length} chars]` : '[MISSING]'}`);
    console.log(`   DATABASE_URL: ${config.DATABASE_URL ? '[PRESENT]' : '[MISSING]'}`);
    console.log(`   PORT: ${config.PORT}`);

    // Validate using Joi schema
    const { error, value } = configValidationSchema.validate(config);
    
    if (error) {
      console.error('❌ Configuration validation failed:', error.message);
      process.exit(1);
    }

    // Additional validations
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
      console.warn('⚠️  JWT_SECRET is shorter than 32 characters - consider using a longer secret for production');
    }

    console.log('🎉 Configuration validation passed!');
    
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    process.exit(1);
  }
}

checkConfig();
