import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class StepFunStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SNS Topic for error notifications
    const errorTopic = new sns.Topic(this, 'ErrorTopic');

    // Example: Add an email subscription (replace with your email)
    errorTopic.addSubscription(new sns_subs.EmailSubscription('tu-email@ejemplo.com'));

    // Lambda: Validar Inventario
    const validarInventarioLambda = new lambda.Function(this, 'ValidarInventarioLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Validando inventario para:', JSON.stringify(event));
          
          // Extraer datos del evento
          const { productoId, cantidad } = event;
          
          // Simular validación de inventario
          const inventarioDisponible = Math.floor(Math.random() * 100) + 1;
          
          // Simula error A (falta de inventario) para probar reintentos
          if (event.forceErrorA || cantidad > inventarioDisponible) {
            const err = new Error('Inventario insuficiente');
            err.name = 'ErrorA';
            throw err;
          }

          if (event.forceErrorB) {
            console.log('ERROR FORZADO: ErrorB activado');
            const err = new Error('Pago rechazado - error forzado para pruebas');
            err.name = 'ErrorB';
            throw err;
          }
          
          return {
            productoId,
            cantidad,
            inventarioDisponible,
            precioUnitario: 25.99,
            total: cantidad * 25.99,
            status: 'InventarioValidado'
          };
        };
      `),
    });

    // Lambda: Procesar Pago
    const procesarPagoLambda = new lambda.Function(this, 'ProcesarPagoLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Procesando pago para:', JSON.stringify(event));
          
          // Recibir datos del paso anterior
          const { productoId, cantidad, total, precioUnitario } = event;
          
          // Simular procesamiento de pago
          const numeroTransaccion = 'TXN-' + Date.now();
          const comision = total * 0.03; // 3% de comisión
          const totalConComision = total + comision;
          
          // Simula error B (problema de pago) - no se reintenta
          if (event.forceErrorB) {
            console.log('ERROR FORZADO: ErrorB activado');
            const err = new Error('Pago rechazado - error forzado para pruebas');
            err.name = 'ErrorB';
            throw err;
          }
          
          // Verificación normal de límite
          if (total > 1000) {
            console.log('ERROR: Total excede límite');
            const err = new Error('Pago rechazado - límite excedido');
            err.name = 'ErrorB';
            throw err;
          }
          
          return {
            productoId,
            cantidad,
            precioUnitario,
            subtotal: total,
            comision,
            totalFinal: totalConComision,
            numeroTransaccion,
            metodoPago: 'Tarjeta de Crédito',
            status: 'PagoProcesado'
          };
        };
      `),
    });

    // Lambda: Enviar Confirmación
    const enviarConfirmacionLambda = new lambda.Function(this, 'EnviarConfirmacionLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Enviando confirmación para:', JSON.stringify(event));
          
          // Recibir datos del paso anterior
          const { productoId, cantidad, totalFinal, numeroTransaccion } = event;
          
          // Simular envío de confirmación
          const numeroOrden = 'ORD-' + Date.now();
          const fechaEntrega = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 días
          
          return {
            numeroOrden,
            numeroTransaccion,
            productoId,
            cantidad,
            totalFinal,
            fechaEntrega: fechaEntrega.toISOString(),
            estadoOrden: 'Confirmada',
            status: 'ConfirmacionEnviada',
            mensaje: 'Su compra ha sido procesada exitosamente'
          };
        };
      `),
    });

    // Lambda: Manejo de Errores (publica en SNS)
    const manejoErroresLambda = new lambda.Function(this, 'ManejoErroresLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      environment: {
        TOPIC_ARN: errorTopic.topicArn,
      },
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const sns = new AWS.SNS();
        exports.handler = async (event) => {
          console.log('Manejando error:', JSON.stringify(event, null, 2));
          
          const errorInfo = {
            timestamp: new Date().toISOString(),
            originalInput: event,
            errorDetails: event.error || 'Error no especificado',
            stepFunction: 'CompraProductoStateMachine'
          };
          
          await sns.publish({
            TopicArn: process.env.TOPIC_ARN,
            Message: JSON.stringify(errorInfo, null, 2),
            Subject: 'Error en Step Function - Proceso de Compra',
          }).promise();
          
          return { 
            status: 'Error Notificado',
            errorHandled: true,
            timestamp: errorInfo.timestamp
          };
        };
      `),
    });
    errorTopic.grantPublish(manejoErroresLambda);

    // Step Function Tasks
    const validarInventarioTask = new tasks.LambdaInvoke(this, 'Validar Inventario', {
      lambdaFunction: validarInventarioLambda,
      outputPath: '$.Payload',
    });
    
    // Configurar reintentos PRIMERO para ErrorA
    validarInventarioTask.addRetry({
      errors: ['ErrorA'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2.0,
    });
    
    validarInventarioTask.addCatch(new sfn.Fail(this, 'Inventario Falló', {
      comment: 'Error después de agotar reintentos',
      cause: 'Inventario insuficiente después de múltiples intentos'
    }), {
      errors: ['ErrorA'],
      resultPath: '$.error',
    });

    const procesarPagoTask = new tasks.LambdaInvoke(this, 'Procesar Pago', {
      lambdaFunction: procesarPagoLambda,
      outputPath: '$.Payload',
    });
    
    // Crear el estado de manejo de errores
    const manejoErrorPagoTask = new tasks.LambdaInvoke(this, 'Manejo de Error Pago', {
      lambdaFunction: manejoErroresLambda,
      outputPath: '$.Payload',
    });
    
    // Para ErrorB: NO reintentar, ir directo al manejo de errores y terminar
    procesarPagoTask.addCatch(manejoErrorPagoTask, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    const enviarConfirmacionTask = new tasks.LambdaInvoke(this, 'Enviar Confirmación', {
      lambdaFunction: enviarConfirmacionLambda,
      outputPath: '$.Payload',
    });

    // Definir el flujo
    const definition = validarInventarioTask
      .next(procesarPagoTask)
      .next(enviarConfirmacionTask);
    
    // El manejo de error de pago debe terminar el flujo exitosamente
    manejoErrorPagoTask.next(new sfn.Succeed(this, 'Error Manejado', {
      comment: 'Error de pago manejado y notificado via SNS'
    }));

    // Crear State Machine con logging habilitado
    new sfn.StateMachine(this, 'CompraProductoStateMachine', {
      definition,
      timeout: cdk.Duration.minutes(5),
      logs: {
        destination: new logs.LogGroup(this, 'StepFunctionLogGroup'),
        level: sfn.LogLevel.ALL,
      },
      tracingEnabled: true,
    });
  }
}
