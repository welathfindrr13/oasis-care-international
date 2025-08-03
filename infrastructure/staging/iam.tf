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
    resources = [aws_secretsmanager_secret.database_url.arn, aws_ssm_parameter.jwt_secret.arn]
  }
}
