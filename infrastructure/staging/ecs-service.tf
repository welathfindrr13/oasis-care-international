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

# API Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-api:staging"

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "NEXTAUTH_URL"
          value = "https://app.oasis-care.co"
        },
        {
          name  = "COGNITO_CLIENT_ID"
          value = "3imuihdo5v7lgimq8je6d38std"
        },
        {
          name  = "COGNITO_ISSUER"
          value = "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_YPo6sl1zm"
        },
        {
          name  = "FRONTEND_URL"
          value = var.frontend_url
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "arn:aws:secretsmanager:eu-west-2:721689331449:secret:oasis/staging/DATABASE_URL"
        },
        {
          name      = "NEXTAUTH_SECRET"
          valueFrom = "arn:aws:secretsmanager:eu-west-2:721689331449:secret:oasis/staging/NEXTAUTH_SECRET"
        },
        {
          name      = "COGNITO_CLIENT_SECRET"
          valueFrom = "arn:aws:secretsmanager:eu-west-2:721689331449:secret:oasis/staging/COGNITO_CLIENT_SECRET"
        }
      ]

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3000/health || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      essential = true
    }
  ])

  tags = var.default_tags
}

# Web Task Definition
resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "web"
      image = "721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-web:staging"

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "NEXTAUTH_URL"
          value = "https://app.oasis-care.co"
        },
        {
          name  = "COGNITO_CLIENT_ID"
          value = "3imuihdo5v7lgimq8je6d38std"
        },
        {
          name  = "COGNITO_ISSUER"
          value = "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_YPo6sl1zm"
        }
      ]

      secrets = [
        {
          name      = "NEXTAUTH_SECRET"
          valueFrom = "arn:aws:secretsmanager:eu-west-2:721689331449:secret:oasis/staging/NEXTAUTH_SECRET"
        }
      ]

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3000/ || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }

      essential = true
    }
  ])

  tags = var.default_tags
}

# API ECS Service
resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]

  # Enable ECS Exec for debugging
  enable_execute_command = true

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = var.default_tags
}

# Web ECS Service
resource "aws_ecs_service" "web" {
  name            = "${local.name_prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]

  # Enable ECS Exec for debugging
  enable_execute_command = true

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = var.default_tags
}
