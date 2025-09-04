#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StepFunStack } from '../stepfun-stack';

const app = new cdk.App();
// NOSONAR ignore
new StepFunStack(app, 'StepFunStack');
