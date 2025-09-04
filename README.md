# Step Function AWS CDK - Flujo de Compra

## 📋 Descripción del Proyecto

Este es un proyecto de prueba desarrollado con AWS CDK (Cloud Development Kit) en Node.js para practicar la orquestación de Step Functions. El objetivo principal es simular un flujo de compra de productos e implementar diferentes estrategias de manejo de errores y reintentos.

## 🏗️ Arquitectura

El proyecto implementa un flujo de 3 pasos principales:

1. **Validar Inventario** - Verifica disponibilidad del producto
2. **Procesar Pago** - Simula el procesamiento del pago
3. **Enviar Confirmación** - Genera y envía confirmación de compra

### Componentes de la Infraestructura

- **Step Function**: Orquesta todo el flujo de compra
- **4 Funciones Lambda**:
  - `ValidarInventario`: Valida inventario disponible
  - `ProcesarPago`: Procesa el pago del producto
  - `EnviarConfirmacion`: Genera confirmación de compra
  - `ManejoErrores`: Maneja errores y envía notificaciones
- **SNS Topic**: Para notificaciones de errores
- **CloudWatch Logs**: Para logging detallado
- **X-Ray**: Para tracing de la ejecución

## 🚨 Manejo de Errores

### ErrorA (Inventario Insuficiente)
- **Comportamiento**: Se reintenta automáticamente
- **Configuración**: 3 reintentos máximo con backoff exponencial
- **Acción**: Si se agotan los reintentos, el flujo falla

### ErrorB (Problema de Pago)
- **Comportamiento**: NO se reintenta
- **Configuración**: Va directo al manejo de errores
- **Acción**: Notifica via SNS y termina el flujo exitosamente

## 🚀 Instrucciones de Despliegue

### Prerrequisitos

1. **Node.js** (versión 18 o superior)
2. **AWS CLI** configurado con credenciales válidas
3. **AWS CDK** instalado globalmente

```bash
npm install -g aws-cdk
```

### Instalación y Despliegue

1. **Clonar el repositorio**:
```bash
git clone <repository-url>
cd step_project
```

2. **Instalar dependencias**:
```bash
npm install
```

3. **Bootstrap CDK** (solo la primera vez):
```bash
npx cdk bootstrap
```

4. **Desplegar la infraestructura**:
```bash
npx cdk deploy
```

## 🧪 Pruebas del Flujo

### Ejecución Exitosa
```json
{
  "productoId": "PROD-123",
  "cantidad": 2
}
```

### Probar ErrorA (Reintentos)
```json
{
  "productoId": "PROD-123",
  "cantidad": 2,
  "forceErrorA": true
}
```

### Probar ErrorB (Sin Reintentos)
```json
{
  "productoId": "PROD-123",
  "cantidad": 2,
  "forceErrorB": true
}
```

## 📊 Monitoreo

### CloudWatch Logs
- Grupo de logs: `/aws/stepfunctions/CompraProducto`
- Ver reintentos y errores detallados

### AWS X-Ray
- Tracing completo de la ejecución
- Visualización del flujo y tiempos

### Step Functions Console
- Visualización gráfica del flujo
- Estado de cada ejecución
- Historial de reintentos

## 🛠️ Comandos Útiles

- `npx cdk diff` - Comparar cambios antes del deploy
- `npx cdk synth` - Generar CloudFormation template
- `npx cdk destroy` - Eliminar toda la infraestructura

## 📝 Notas

Este proyecto es únicamente para fines educativos y de práctica. Las funciones Lambda contienen lógica simulada y no realizan operaciones reales de inventario o pagos.

## 🔧 Tecnologías Utilizadas

- **AWS CDK** v2
- **Node.js** / TypeScript
- **AWS Step Functions**
- **AWS Lambda**
- **Amazon SNS**
- **CloudWatch Logs**
- **AWS X-Ray**
