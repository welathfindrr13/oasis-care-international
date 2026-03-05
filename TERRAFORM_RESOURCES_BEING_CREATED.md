# 39 Resources Being Created by Terraform Apply

## IAM & Security (7 resources)
1. `aws_iam_role.ecs_task_execution` - ECS task execution role
2. `aws_iam_role.ecs_task_role` - ECS task role for app permissions
3. `aws_iam_role.lambda_embedding_execution` - Lambda execution role
4. `aws_iam_policy.bedrock_access` - Policy for AI/Bedrock access
5. `aws_iam_role_policy_attachment.ecs_exec_policy` - Attach execution policy
6. `aws_iam_role_policy_attachment.lambda_bedrock` - Attach Bedrock policy
7. `aws_security_group_rule.ecs_ingress_from_alb` - Allow ALB→ECS traffic

## Network & DNS (5 resources)
8. `aws_route53_record.api` - A record for api.oasis-care.co
9. `aws_route53_record.api_ipv6` - AAAA record for api.oasis-care.co
10. `aws_route53_record.web` - A record for app.oasis-care.co
11. `aws_route53_record.web_ipv6` - AAAA record for app.oasis-care.co  
12. `aws_security_group.alb` - NEW ALB security group (replaces old one in wrong VPC)

## Load Balancer & Listeners (4 resources)
13. `aws_lb_listener.http` - HTTP listener (redirects to HTTPS)
14. `aws_lb_listener.https` - HTTPS listener with SSL
15. `aws_lb_listener_certificate.web` - Web domain SSL certificate
16. `aws_lb_listener_rule.api` - Route api.oasis-care.co to API target group
17. `aws_lb_listener_rule.web` - Route app.oasis-care.co to Web target group

## Database (2 resources)
18. `aws_db_instance.postgres` - RDS PostgreSQL 15.6 database
19. `aws_secretsmanager_secret.database_url` - Secret for DB connection string
20. `aws_secretsmanager_secret_version.database_url` - Secret value

## ECS Services (6 resources)
21. `aws_ecs_task_definition.api` - API container task definition
22. `aws_ecs_task_definition.web` - Web container task definition  
23. `aws_ecs_service.api` - API ECS service
24. `aws_ecs_service.web` - Web ECS service
25. `aws_appautoscaling_target.api` - Auto-scaling for API
26. `aws_appautoscaling_policy.api_cpu` - CPU-based scaling policy

## Lambda & EventBridge (5 resources)
27. `aws_lambda_function.embedding_generator` - AI embedding generator
28. `aws_cloudwatch_log_group.embedding_lambda_logs` - Lambda logs
29. `aws_cloudwatch_event_target.embedding_lambda_target` - Schedule trigger
30. `aws_lambda_permission.allow_eventbridge` - EventBridge invoke permission
31. `aws_iam_role_policy_attachment.lambda_embedding_policy` - Lambda policies

## Monitoring & Alarms (9 resources)
32. `aws_cloudwatch_metric_alarm.alb_response_time` - ALB latency alarm
33. `aws_cloudwatch_metric_alarm.alb_target_5xx_errors` - ALB 5XX alarm
34. `aws_cloudwatch_metric_alarm.ecs_cpu_utilization` - ECS CPU alarm
35. `aws_cloudwatch_metric_alarm.ecs_memory_utilization` - ECS memory alarm
36. `aws_cloudwatch_metric_alarm.rds_cpu_utilization` - RDS CPU alarm
37. `aws_cloudwatch_metric_alarm.rds_database_connections` - RDS connections alarm
38. `aws_cloudwatch_log_metric_filter.api_errors` - API error log filter
39. `aws_cloudwatch_log_metric_filter.web_errors` - Web error log filter

## Plus:
- 1 resource being **changed** (ALB to use new security group)
- 1 resource being **destroyed** (old ALB security group in wrong VPC)

---

## Summary by Category

**Core Infrastructure:**
- 1 RDS Database
- 2 ECS Services (API + Web)
- 1 Application Load Balancer (existing, being updated)
- 4 Route53 DNS Records

**Security & Access:**
- 3 IAM Roles
- 4 IAM Policy Attachments
- 1 Security Group (new, replacing old)
- 1 Security Group Rule
- 2 Secrets Manager resources

**Compute:**
- 2 ECS Task Definitions
- 1 Lambda Function
- 2 Auto-scaling resources

**Monitoring:**
- 6 CloudWatch Alarms
- 2 CloudWatch Log Metric Filters
- 2 CloudWatch Log Groups
- 1 EventBridge Event Target
- 1 Lambda Permission

**Total:** 39 new resources + 1 updated + 1 destroyed = 41 resource operations
