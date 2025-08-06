resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecsTaskExec"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Attach AWS‑managed execution policy (pull from ECR, write logs)
resource "aws_iam_role_policy_attachment" "ecs_task_exec_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow reading Secrets Manager & SSM params
resource "aws_iam_role_policy" "read_secrets" {
  name   = "ReadSecrets"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.read_secrets.json
}

data "aws_iam_policy_document" "read_secrets" {
  statement {
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.database_url.arn,
      aws_secretsmanager_secret.jwt_signing_key.arn,  # New JWT secret
      aws_ssm_parameter.jwt_secret.arn                 # Keep temporarily for rollback
    ]
  }
}

# Bedrock access for AI Health Summarizer
resource "aws_iam_role_policy" "bedrock_access" {
  name   = "BedrockAccess"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.bedrock_access.json
}

data "aws_iam_policy_document" "bedrock_access" {
  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:aws:bedrock:eu-west-2::foundation-model/anthropic.claude-3-haiku-*"
    ]
  }
}

# Lambda execution role for embedding generation
resource "aws_iam_role" "lambda_embedding_execution" {
  name               = "${local.name_prefix}-lambda-embedding"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# Attach AWS managed Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_embedding_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda VPC execution permissions
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.lambda_embedding_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Lambda permissions for database and Bedrock
resource "aws_iam_role_policy" "lambda_embedding_permissions" {
  name   = "EmbeddingPermissions"
  role   = aws_iam_role.lambda_embedding_execution.id
  policy = data.aws_iam_policy_document.lambda_embedding_permissions.json
}

data "aws_iam_policy_document" "lambda_embedding_permissions" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue"
    ]
    resources = [
      aws_secretsmanager_secret.database_url.arn
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel"
    ]
    resources = [
      "arn:aws:bedrock:eu-west-2::foundation-model/anthropic.claude-3-haiku-*"
    ]
  }
}
