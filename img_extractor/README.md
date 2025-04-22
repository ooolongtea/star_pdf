# 专利图像提取API服务

本项目提供了一套专利文档中分子结构图像处理的API服务，能自动识别分子结构、反应图式和分子共指关系。支持多GPU并行处理，适用于大规模专利数据批量处理。

## 目录

- [功能特点](#功能特点)
- [系统要求](#系统要求)
- [安装指南](#安装指南)
- [快速开始](#快速开始)
  - [启动服务器](#启动服务器)
  - [使用客户端](#使用客户端)
- [命令行参数](#命令行参数)
  - [服务器参数](#服务器参数)
  - [客户端参数](#客户端参数)
- [使用示例](#使用示例)
  - [处理单个专利](#处理单个专利)
  - [批量处理专利](#批量处理专利)
  - [上传并处理专利](#上传并处理专利)
- [工作模式](#工作模式)
  - [本地模式](#本地模式)
  - [远程模式](#远程模式)
- [常见问题](#常见问题)
- [API接口文档](#api接口文档)

## 快速开始

### 启动服务器

服务器支持多种启动配置：

**使用所有可用GPU**：
```bash
python run_api_server.py
```

**指定使用特定GPU**：
```bash
# 使用ID为0和1的GPU
python run_api_server.py --gpu-devices 0,1

# 仅使用ID为0的GPU
python run_api_server.py --gpu-devices 0
```

**自定义端口和进程数**：
```bash
# 指定端口7890，每个GPU启动3个进程
python run_api_server.py --gpu-devices 0,1 --processes 2
```

### 使用客户端

客户端提供了多种操作模式：

**处理单个专利**：
```bash
python run_api_client.py process /home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/CN105330720 --wait
```

**批量处理专利**：
```bash
python run_api_client.py batch /path/to/patents_dir --output-dir /path/to/output --wait
```

**上传并处理专利**：
```bash
python run_api_client.py upload /path/to/patent
```

## 命令行参数

### 服务器参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--host` | 服务器主机名 | 0.0.0.0 |
| `--port` | 服务器端口号 | 5000 |
| `--data-dir` | 数据目录路径 | ~/patent_data |
| `--gpu-devices` | GPU设备ID列表，以逗号分隔 | 所有可用GPU |
| `--connection-limit` | 最大连接数 | 500 |
| `--processes` | 每个设备的进程数 | 8 |
| `--debug` | 启用调试模式 | False |

### 客户端参数

**全局参数**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--server` | 服务器URL | http://localhost:7878 |
| `--remote` | 远程模式，路径指向服务器上的位置 | False |

**处理命令参数**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--device` | 指定处理设备 | 自动选择 |
| `--wait` | 等待处理完成 | False |
| `--output-dir` | 指定输出目录 | 自动生成 |
| `--no-save` | 不保存结果到本地 | False |
| `--download-dir` | 下载结果的目录 | 当前目录 |

## 使用示例

### 处理单个专利

**本地模式**：
```bash
# 处理本地专利文件，等待完成
python run_api_client.py process /path/to/patent --wait

# 指定设备和输出目录
python run_api_client.py process /path/to/patent --device 0 --output-dir /path/to/output --wait
```

**远程模式**：
```bash
# 处理服务器上的专利文件
python run_api_client.py --remote process /home/user/patents/CN104230815 --wait
```

### 批量处理专利

**本地模式**：
```bash
# 批量处理本地专利目录
python run_api_client.py batch /path/to/patents_dir --output-dir /path/to/output --wait
```

**远程模式**：
```bash
# 批量处理服务器上的专利目录
python run_api_client.py --remote batch /home/user/patents --wait
```

### 上传并处理专利

```bash
# 上传并处理单个专利
python run_api_client.py upload /path/to/patent.pdf

# 上传并批量处理
python run_api_client.py upload-batch /path/to/patents_dir
```

## 工作模式

### 本地模式

- 文件位于客户端本地
- 客户端上传文件到服务器
- 结果保存到客户端本地

### 远程模式

- 文件位于服务器上
- 客户端只发送路径信息
- 服务器直接处理服务器上的文件
- 适用于客户端和服务器在同一网络或同一机器上

## 常见问题

### 内存不足

- 减少每个设备的进程数：`--processes 1`
- 调整批处理大小，分批处理

### GPU显存不足

- 使用 `--processes 1` 减少并行处理
- 手动清理GPU缓存：`torch.cuda.empty_cache()`

### 路径问题

- 远程模式：确保使用服务器上的正确路径
- 避免路径中的特殊字符
- Windows和Linux路径格式不同，注意区分

### 服务器无响应

- 检查服务器日志
- 确认服务器端口是否正确
- 检查防火墙设置

## API接口文档

### 服务器状态

获取服务器状态信息

**请求**：`GET /api/status`

**响应**：
```json
{
  "status": "running",
  "uptime": 3600,
  "uptime_formatted": "1小时 0分钟 0秒",
  "data_directory": "/home/user/patent_data",
  "devices": ["cuda:0", "cuda:1"],
  "active_connections": 2,
  "connection_limit": 500,
  "version": "1.0.0"
}
```

### 处理专利

处理单个专利

**请求**：`POST /api/process_patent`

**请求体**：
```json
{
  "patent_id": "CN104230815",
  "patent_path": "/path/to/patent/CN104230815.pdf",
  "output_dir": "/path/to/output",
  "options": {
    "option1": "value1",
    "option2": "value2"
  }
}
```

**响应**：
```json
{
  "success": true,
  "patent_id": "CN104230815",
  "message": "处理完成",
  "results_path": "/path/to/output/CN104230815",
  "processing_time": 15.5,
  "details": {
    "molecules_count": 10,
    "reactions_count": 2
  }
}
```

更多API接口详情请参考[API文档](api/README.md)。
