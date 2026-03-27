# SQS Dead Letter Queue
resource "aws_sqs_queue" "notifications_dlq" {
  name = "${local.name_prefix}-notifications-dlq.fifo"

  # FIFO queue settings
  fifo_queue                  = true
  content_based_deduplication = true

  # DLQ settings
  message_retention_seconds = 1209600 # 14 days

  tags = merge(var.default_tags, {
    Name = "${local.name_prefix}-notifications-dlq"
  })
}

# Main SQS Queue with DLQ
resource "aws_sqs_queue" "notifications" {
  name = "${local.name_prefix}-notifications.fifo"

  # FIFO queue settings
  fifo_queue                  = true
  content_based_deduplication = true

  # Queue settings
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 30

  # Dead letter queue configuration
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(var.default_tags, {
    Name = "${local.name_prefix}-notifications"
  })
}

# Queue IAM is granted where it is actually needed; keeping an unattached
# placeholder policy in Terraform just creates churn.
