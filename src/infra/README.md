# phroobinwal Infrastructure

## Setup instructions
> **Note**
> Lines with `▶` can be clicked on to expand and see source code.
1. Create an IAM user to publish/deploy.
    * <details><summary>CDK deployment policy</summary>
    
        ```json
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "sts:AssumeRole"
                    ],
                    "Resource": [
                        "arn:aws:iam::*:role/cdk-*"
                    ]
                }
            ]
        }
        ```
   
    </details>
1. Save the credentials.
   * If using GitHub Actions (like this repository is), add the `AWS_ACCOUNT_ID`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` to the repository secrets.
   * Run `aws configure` or set credentials file manually, and save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
1. Bootstrap the stack.
   * <details><summary>From this directory...</summary>
    
        ```shell
        $ source .venv/bin/activate
        $ cdk bootstrap
        ```

### Manual Deployment
1. Deploy the application.
   * <details><summary>From this directory...</summary>
    
        ```shell
        $ cdk deploy
        ```

### Automated Deployment
1. Make some changes to the codebase.
1. Push the changes to GitHub.
   * Our GitHub actions will automatically deploy the application as long as the push comes from the `main` branch.

