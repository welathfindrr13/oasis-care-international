# AWS setup for Oasis devs

## 1. Install CLI  
**Homebrew** → `brew install awscli`  
**or** grab the AWS PKG installer from https://aws.amazon.com/cli/

## 2. Configure profile

```bash
aws configure --profile oasis
# AWS Access Key ID [****]: [paste your access key]
# AWS Secret Access Key [****]: [paste your secret key]
# Default region name [eu-west-2]: eu-west-2
# Default output format [json]: json
```

## 3. Test it works

```bash
aws sts get-caller-identity --profile oasis
```

Should return something like:
```json
{
    "UserId": "AIDACK...",
    "Account": "721689331449", 
    "Arn": "arn:aws:iam::721689331449:user/oasis-deploy"
}
```

## 4. ECR login (optional)

To manually push/pull images:

```bash
aws ecr get-login-password --region eu-west-2 --profile oasis | \
  docker login --username AWS --password-stdin 721689331449.dkr.ecr.eu-west-2.amazonaws.com
```

## 5. Helper script

Use `scripts/test-aws.sh` for a quick credential check.

---

## GitHub Actions

The CI pipeline uses these repository secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY` 
- `AWS_DEFAULT_REGION` (eu-west-2)

Workflows automatically:
- Run AWS sanity checks (`aws-check.yml`)
- Build & push Docker images to ECR (`docker-ecr.yml`)
