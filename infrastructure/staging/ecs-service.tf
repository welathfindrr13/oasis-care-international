resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "api",
      image     = "721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-backend:latest",
      portMappings = [{ containerPort = 4000, protocol = "tcp" }],
      environment = [
        { name = "PORT",         value = "4000" },
        { name = "NODE_ENV",     value = "production" },
        { name = "FRONTEND_URL", value = var.frontend_url }
      ],
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "JWT_SECRET",   valueFrom = aws_ssm_parameter.jwt_secret.arn }
      ],
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:4000/healthz || exit 1"],
        interval    = 30,
        timeout     = 5,
        retries     = 3,
        startPeriod = 60
      },
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          awslogs-group         = "/ecs/${local.name_prefix}",
          awslogs-region        = var.aws_region,
          awslogs-stream-prefix = "api"
        }
      }
    }
  ])
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = 14
}

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 4000
  }

  lifecycle { 
    ignore_changes = [desired_count] 
  }
}
