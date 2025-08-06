resource "aws_secretsmanager_secret" "database_url" { 
  name = "oasis/staging/DB_URL" 
}

resource "aws_secretsmanager_secret_version" "database_url_version" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:5432/oasis_staging?schema=public"
}

# New shared JWT secret for all environments
resource "aws_secretsmanager_secret" "jwt_signing_key" {
  name        = "oasis/jwt-signing-key"
  description = "JWT signing key shared across all Oasis environments"
  
  tags = {
    Environment = var.environment
    Project     = "oasis"
    Purpose     = "jwt-signing"
  }
}

# Read existing SSM parameter value to preserve it
data "aws_ssm_parameter" "existing_jwt_secret" {
  name = "/oasis/staging/JWT_SECRET"
}

# Set initial secret version with existing value to avoid breaking sessions
resource "aws_secretsmanager_secret_version" "jwt_signing_key_version" {
  secret_id     = aws_secretsmanager_secret.jwt_signing_key.id
  secret_string = jsonencode({
    value = data.aws_ssm_parameter.existing_jwt_secret.value
  })
}

# Keep SSM parameter temporarily for rollback capability
resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/oasis/staging/JWT_SECRET"
  type  = "SecureString"
  value = random_password.jwt.result
  
  tags = {
    Environment = var.environment
    Status      = "deprecated-migrating-to-secrets-manager"
  }
}
