output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = aws_lb.api.dns_name
}

output "graphql_endpoint" {
  description = "External URL for the GraphQL API"
  value       = "https://${var.domain_name}/graphql"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "private_subnet_ids" {
  description = "Private subnet IDs for migration script"
  value       = aws_subnet.private[*].id
}

output "ecs_security_group_id" {
  description = "ECS security group ID for migration script"
  value       = aws_security_group.ecs.id
}
