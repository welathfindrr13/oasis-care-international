# Load Balancer Outputs
output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer for Route53 alias"
  value       = aws_lb.main.zone_id
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_api_service_name" {
  description = "API ECS service name"
  value       = aws_ecs_service.api.name
}

output "ecs_web_service_name" {
  description = "Web ECS service name"
  value       = aws_ecs_service.web.name
}

output "ecs_api_service_arn" {
  description = "API ECS service ARN"
  value       = aws_ecs_service.api.id
}

output "ecs_web_service_arn" {
  description = "Web ECS service ARN"
  value       = aws_ecs_service.web.id
}

# Database Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.address
}

# ECR Outputs
output "ecr_api_repository_url" {
  description = "API ECR repository URL"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  description = "Web ECR repository URL"
  value       = aws_ecr_repository.web.repository_url
}

# API Endpoints
output "api_endpoint" {
  description = "External URL for the API"
  value       = "https://${var.api_domain}"
}

output "web_endpoint" {
  description = "External URL for the Web App"
  value       = "https://${var.web_domain}"
}

output "graphql_endpoint" {
  description = "External URL for the GraphQL API"
  value       = "https://${var.api_domain}/graphql"
}

# Network Outputs (for migration scripts)
output "private_subnet_ids" {
  description = "Private subnet IDs for migration script"
  value       = local.private_subnet_ids
}

output "ecs_security_group_id" {
  description = "ECS security group ID for migration script"
  value       = aws_security_group.ecs.id
}

output "vpc_id" {
  description = "VPC ID"
  value       = data.aws_vpc.main.id
}

# Target Group Outputs
output "api_target_group_arn" {
  description = "API target group ARN"
  value       = aws_lb_target_group.api.arn
}

output "web_target_group_arn" {
  description = "Web target group ARN"
  value       = aws_lb_target_group.web.arn
}
