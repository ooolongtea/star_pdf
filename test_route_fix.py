#!/usr/bin/env python3
"""
测试路由修复
验证化学式提取服务器的路由是否正确注册
"""

import requests
import json
import sys
import time

# 配置
CHEMICAL_SERVER_URL = "http://localhost:8011"  # 化学式提取服务器地址

def test_routes():
    """测试各个路由是否可用"""
    routes_to_test = [
        ("/api/health", "GET", "健康检查"),
        ("/api/status", "GET", "服务器状态"),
        ("/api/tasks", "GET", "任务列表"),
        ("/api/upload_and_process_alt", "POST", "上传处理路由（备用）"),
        ("/api/upload_and_process", "POST", "上传处理路由"),
        ("/api/process_patent", "POST", "处理专利路由"),
    ]
    
    print("=" * 60)
    print("测试路由可用性")
    print("=" * 60)
    
    available_routes = []
    unavailable_routes = []
    
    for route, method, description in routes_to_test:
        url = f"{CHEMICAL_SERVER_URL}{route}"
        print(f"\n测试 {description}: {method} {route}")
        
        try:
            if method == "GET":
                response = requests.get(url, timeout=5)
            else:
                # 对于POST路由，我们只是检查是否返回正确的错误（而不是404）
                response = requests.post(url, timeout=5)
            
            print(f"  状态码: {response.status_code}")
            
            if response.status_code == 404:
                print(f"  ❌ 路由不存在")
                unavailable_routes.append((route, description))
            elif response.status_code in [200, 400, 422, 500]:
                # 200: 成功, 400: 请求错误, 422: 验证错误, 500: 服务器错误
                # 这些都表明路由存在
                print(f"  ✅ 路由存在")
                available_routes.append((route, description))
            else:
                print(f"  ⚠️  未知状态码: {response.status_code}")
                available_routes.append((route, description))
                
        except requests.exceptions.RequestException as e:
            print(f"  ❌ 请求失败: {e}")
            unavailable_routes.append((route, description))
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    print(f"\n✅ 可用路由 ({len(available_routes)}):")
    for route, description in available_routes:
        print(f"  - {route} ({description})")
    
    print(f"\n❌ 不可用路由 ({len(unavailable_routes)}):")
    for route, description in unavailable_routes:
        print(f"  - {route} ({description})")
    
    return len(unavailable_routes) == 0

def test_upload_and_process_alt():
    """专门测试 upload_and_process_alt 路由"""
    print("\n" + "=" * 60)
    print("专门测试 upload_and_process_alt 路由")
    print("=" * 60)
    
    url = f"{CHEMICAL_SERVER_URL}/api/upload_and_process_alt"
    
    # 创建一个简单的测试文件
    test_content = b"test file content"
    files = {
        'patent_folder': ('test.zip', test_content, 'application/zip')
    }
    data = {
        'batch_mode': 'false'
    }
    
    try:
        print(f"发送测试请求到: {url}")
        response = requests.post(url, files=files, data=data, timeout=10)
        
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 404:
            print("❌ 路由不存在 - 这是主要问题!")
            return False
        elif response.status_code == 422:
            print("✅ 路由存在，但参数验证失败 - 这是正常的")
            try:
                error_detail = response.json()
                print(f"验证错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
            except:
                print(f"响应内容: {response.text}")
            return True
        elif response.status_code == 500:
            print("✅ 路由存在，但服务器内部错误 - 这表明路由已注册")
            try:
                error_detail = response.json()
                print(f"服务器错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
            except:
                print(f"响应内容: {response.text}")
            return True
        else:
            print(f"✅ 路由存在，状态码: {response.status_code}")
            try:
                response_data = response.json()
                print(f"响应数据: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
            except:
                print(f"响应内容: {response.text}")
            return True
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求失败: {e}")
        return False

def main():
    """主函数"""
    print("化学式提取服务器路由修复测试")
    print("=" * 60)
    
    # 首先检查服务器是否运行
    try:
        response = requests.get(f"{CHEMICAL_SERVER_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ 服务器正在运行")
        else:
            print(f"⚠️  服务器响应异常: {response.status_code}")
    except requests.exceptions.RequestException:
        print("❌ 无法连接到服务器，请确保服务器正在运行")
        print(f"服务器地址: {CHEMICAL_SERVER_URL}")
        return 1
    
    # 测试路由可用性
    routes_ok = test_routes()
    
    # 专门测试问题路由
    upload_alt_ok = test_upload_and_process_alt()
    
    print("\n" + "=" * 60)
    print("最终结果")
    print("=" * 60)
    
    if routes_ok and upload_alt_ok:
        print("🎉 所有测试通过！路由修复成功！")
        return 0
    else:
        print("❌ 部分测试失败，需要进一步检查")
        return 1

if __name__ == "__main__":
    sys.exit(main())
