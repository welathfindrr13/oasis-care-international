# Lambda function for generating embeddings and health summaries
resource "aws_lambda_function" "embedding_generator" {
  function_name = "${local.name_prefix}-embedding-generator"
  role          = aws_iam_role.lambda_embedding_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 900 # 15 minutes
  memory_size   = 1024

  # Placeholder code - will be replaced by deployment pipeline
  filename         = "${path.module}/lambda-placeholder.zip"
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  vpc_config {
    subnet_ids         = local.private_subnet_ids
    security_group_ids = [aws_security_group.lambda_embedding.id]
  }

  environment {
    variables = {
      DATABASE_URL           = aws_secretsmanager_secret.database_url.arn
      BEDROCK_MODEL          = "anthropic.claude-3-haiku-20240307-v1:0"
      AWS_REGION             = var.aws_region
      NODE_ENV               = "production"
      AI_SUMMARY_ENABLED_ENV = var.ai_summary_enabled ? "true" : "false"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy.lambda_embedding_permissions
  ]

  tags = {
    Name        = "${local.name_prefix}-embedding-generator"
    Environment = "staging"
    Purpose     = "ai-health-summarizer"
  }
}

# Placeholder Lambda deployment package
data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/lambda-placeholder.zip"

  source {
    content = jsonencode({
      message = "Placeholder Lambda - will be replaced by CI/CD"
      exports = {
        handler = "async function handler(event) { console.log('Placeholder Lambda executed', event); return { statusCode: 200, body: 'OK' }; }"
      }
    })
    filename = "index.js"
  }
}

# Security group for Lambda in VPC
resource "aws_security_group" "lambda_embedding" {
  name_prefix = "${local.name_prefix}-lambda-embedding-"
  vpc_id      = data.aws_vpc.main.id
  description = "Security group for embedding generation Lambda"

  # Outbound to RDS
  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "PostgreSQL access"
  }

  # Outbound for Bedrock API calls
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for Bedrock API"
  }

  # Outbound for Secrets Manager
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for AWS API calls"
  }

  tags = {
    Name        = "${local.name_prefix}-lambda-embedding-sg"
    Environment = "staging"
  }
}

# CloudWatch Event Rule - Friday 02:00 UK time (UTC)
resource "aws_cloudwatch_event_rule" "embedding_schedule" {
  name                = "${local.name_prefix}-embedding-schedule"
  description         = "Trigger embedding generation every Friday at 02:00 UK time"
  schedule_expression = "cron(0 2 ? * FRI *)"

  tags = {
    Name        = "${local.name_prefix}-embedding-schedule"
    Environment = "staging"
    Purpose     = "ai-health-summarizer"
  }
}

# CloudWatch Event Target
resource "aws_cloudwatch_event_target" "embedding_lambda_target" {
  rule      = aws_cloudwatch_event_rule.embedding_schedule.name
  target_id = "EmbeddingLambdaTarget"
  arn       = aws_lambda_function.embedding_generator.arn

  input = jsonencode({
    source      = "cloudwatch-events"
    detail_type = "Scheduled Event"
    detail = {
      schedule = "weekly-friday-2am"
      purpose  = "health-summary-generation"
    }
  })
}

# Permission for CloudWatch Events to invoke Lambda
resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.embedding_generator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.embedding_schedule.arn
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "embedding_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.embedding_generator.function_name}"
  retention_in_days = 14

  tags = {
    Name        = "${local.name_prefix}-embedding-lambda-logs"
    Environment = "staging"
  }
}
