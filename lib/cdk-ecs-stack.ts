import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import { SubnetType } from '@aws-cdk/aws-ec2';
import { Role } from '@aws-cdk/aws-iam';

export class CdkEcsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC and Fargate Cluster
    // NOTE: Limit AZs to avoid reaching resource quotas
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr: '10.110.0.0/16',
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          cidrMask: 24,
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'ecs-sample',
      containerInsights: true,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'Task', {
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole: this._createTaskRole(),
    });

    taskDefinition.addContainer('Nginx', {
      image: ecs.ContainerImage.fromRegistry('nginx'),
      portMappings: [{ containerPort: 80 }],
    });

    // Instantiate Fargate Service with just cluster and image
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'FargateService',
      {
        serviceName: 'FargateService',
        cluster,
        assignPublicIp: true,
        publicLoadBalancer: true,

        desiredCount: 1,

        taskDefinition,
      }
    );

    // @see https://github.com/pahud/ecs-exec-cdk-demo
    // Enable ECS Exec
    const cfnService = fargateService.service.node.findChild(
      'Service'
    ) as ecs.CfnService;
    cfnService.addPropertyOverride('EnableExecuteCommand', true);

    // Setup AutoScaling policy
    const scaling = fargateService.service.autoScaleTaskCount({
      maxCapacity: 2,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    new cdk.CfnOutput(this, 'EcsExecCommand', {
      value: `ecs_exec_service ${cluster.clusterName} ${fargateService.service.serviceName} ${taskDefinition.defaultContainer?.containerName}`,
    });
  }

  private _createTaskRole(): Role {
    const role = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssmmessages:CreateControlChannel',
          'ssmmessages:CreateDataChannel',
          'ssmmessages:OpenControlChannel',
          'ssmmessages:OpenDataChannel',
        ],
        resources: ['*'],
      })
    );

    return role;
  }
}
