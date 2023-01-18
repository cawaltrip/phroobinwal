#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infraStack';

const app = new cdk.App();

const appName = app.node.tryGetContext("appName") || "InfraStack"

const envUS = { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" };

new InfraStack(app, appName, {
  env: envUS
});