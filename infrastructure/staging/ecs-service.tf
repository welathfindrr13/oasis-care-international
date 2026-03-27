# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/oasis-api-staging"
  retention_in_days = 14
  tags              = var.default_tags
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/oasis-web-staging"
  retention_in_days = 14
  tags              = var.default_tags
}

# Staging deploys register task definition revisions outside Terraform.
# Read the active family revisions so Terraform can manage the service shell
# without trying to overwrite runtime images, secrets, or release metadata.
data "aws_ecs_task_definition" "api" {
  task_definition = "${local.name_prefix}-api"
}

data "aws_ecs_task_definition" "web" {
  task_definition = "${local.name_prefix}-web"
}

# API ECS Service
resource "aws_ecs_service" "api" {
  name                               = "${local.name_prefix}-api"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = data.aws_ecs_task_definition.api.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 50
  health_check_grace_period_seconds  = 180
  wait_for_steady_state              = false

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]

  # Keep staging lean: ECS Exec is disabled, so we do not need SSM endpoints.
  enable_execute_command = false

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = var.default_tags
}

# Web ECS Service
resource "aws_ecs_service" "web" {
  name                              = "${local.name_prefix}-web"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = data.aws_ecs_task_definition.web.arn
  desired_count                     = 1
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 180
  wait_for_steady_state             = false

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]

  # Keep staging lean: ECS Exec is disabled, so we do not need SSM endpoints.
  enable_execute_command = false

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = var.default_tags
}
