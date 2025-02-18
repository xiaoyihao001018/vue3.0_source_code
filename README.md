# 运行项目
```bash
pnpm i
pnpm dev:example
```

# Vue3 核心模块

## 1. 响应式系统 (reactivity)
- reactive: 对象响应式
- ref: 基本类型响应式
- computed: 计算属性
- effect: 副作用函数
- watch: 侦听器

## 2. 运行时核心 (runtime-core)
- 虚拟 DOM (Virtual DOM)
  - 创建虚拟节点
  - Diff 算法
  - 节点更新
- 组件系统
  - 组件创建
  - 组件更新
  - 组件生命周期
- 渲染器 (Renderer)
  - 挂载
  - 更新
  - 卸载

## 3. 编译器 (compiler)
- 模板解析 (Parser)
  - 解析模板为 AST
- 优化 (Optimizer)
  - 静态提升
  - 补丁标记
- 代码生成 (CodeGen)
  - 生成渲染函数

## 4. 运行时 DOM (runtime-dom)
- DOM 操作
- 事件处理
- 属性处理
- CSS 处理

## 5. Composition API
- setup 函数
- 生命周期钩子
- provide/inject

## 6. 内置组件
- Teleport
- Suspense
- KeepAlive
- Transition

## 项目结构
```
packages/
├── reactivity/          # 响应式系统
├── runtime-core/        # 运行时核心
├── runtime-dom/         # 浏览器运行时
├── compiler-core/       # 编译器核心
├── compiler-dom/        # 浏览器编译器
└── shared/             # 公共工具
```

## 实现顺序
1. 响应式系统
   - [x] reactive
   - [x] effect
   - [ ] ref
   - [ ] computed
   - [ ] watch

2. 运行时核心
   - [ ] 虚拟 DOM
   - [ ] 组件系统
   - [ ] 渲染器

3. 编译器
   - [ ] 模板解析
   - [ ] 优化
   - [ ] 代码生成

4. 其他特性
   - [ ] 生命周期
   - [ ] 指令系统
   - [ ] 内置组件

# 响应式系统

以这段代码为例：
```typescript
const state = reactive({ count: 0 })

effect(() => {
  console.log('count is:', state.count)
})

state.count++ // 修改值会触发上面的 effect 重新执行
```

### 第一步：创建响应式对象

当执行 `reactive({ count: 0 })` 时：

```typescript
// reactive.ts
export function reactive(target: object) {
  // 1. 首先检查是否是对象
  if (!target || typeof target !== 'object') {
    return target
  }

  // 2. 检查是否已经是响应式对象
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target
  }

  // 3. 检查是否已经有对应的代理对象
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 4. 创建新的代理对象
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      if (key === ReactiveFlags.IS_REACTIVE) {
        return true
      }
      
      // 4.1 收集依赖
      track(target, key)
      
      // 4.2 返回属性值
      return Reflect.get(target, key, receiver)
    },
    
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      
      // 4.3 触发更新
      if (oldValue !== value) {
        trigger(target, key)
      }
      
      return result
    }
  })

  // 5. 缓存并返回代理对象
  reactiveMap.set(target, proxy)
  return proxy
}
```

### 第二步：创建副作用函数

当执行 `effect(() => { console.log('count is:', state.count) })` 时：

```typescript
// effect.ts
export function effect<T = any>(fn: () => T) {
  // 1. 创建 ReactiveEffect 实例
  const _effect = new ReactiveEffect(fn)
  
  // 2. 立即执行一次副作用函数进行依赖收集
  _effect.run()
  
  // 3. 返回绑定了 this 的 run 函数
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
}

// ReactiveEffect 类的工作
class ReactiveEffect {
  active = true
  deps: Dep[] = []  // 存储所有相关的依赖集合
  
  constructor(public fn: () => T) {}

  run() {
    if (!this.active) {
      return this.fn()
    }

    try {
      // 1. 设置当前活跃的 effect
      activeEffect = this
      // 2. 执行用户函数，这时会触发代理对象的 get
      return this.fn()
    } finally {
      // 3. 清理当前活跃的 effect
      activeEffect = undefined
    }
  }
}
```

### 第三步：依赖收集

当执行 `state.count` 时，触发 get 拦截器，调用 track 函数：

```typescript
// effect.ts
export function track(target: object, key: unknown) {
  // 1. 检查是否有正在执行的 effect
  if (!activeEffect) return
  
  // 2. 获取目标对象的依赖图
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    // 2.1 如果没有，创建一个新的 Map
    targetMap.set(target, (depsMap = new Map()))
  }
  
  // 3. 获取特定属性的依赖集合
  let dep = depsMap.get(key)
  if (!dep) {
    // 3.1 如果没有，创建一个新的 Set
    depsMap.set(key, (dep = new Set()))
  }
  
  // 4. 添加当前 effect 到依赖集合
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    // 5. 在 effect 中也记录这个依赖集合
    activeEffect.deps.push(dep)
  }
}
```

此时的依赖关系图：
```
targetMap (WeakMap)
  └─ { count: 0 } (原始对象) -> depsMap (Map)
       └─ "count" -> Set([ReactiveEffect])
```

### 第四步：触发更新

当执行 `state.count++` 时：

1. 触发代理对象的 set 拦截器
2. 调用 trigger 函数：

```typescript
// effect.ts
export function trigger(target: object, key: unknown) {
  // 1. 获取目标对象的依赖图
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  // 2. 获取特定属性的依赖集合
  const dep = depsMap.get(key)
  if (dep) {
    // 3. 创建一个新的 Set 避免无限循环
    const effects = new Set(dep)
    // 4. 执行所有相关的副作用函数
    effects.forEach(effect => {
      // 4.1 如果有调度器，使用调度器
      if (effect.scheduler) {
        effect.scheduler()
      } else {
        // 4.2 否则直接运行副作用函数
        effect.run()
      }
    })
  }
}
```

完整的数据流向：
```README.md
1. reactive({ count: 0 })
   └─ 创建代理对象，设置 get/set 拦截器

2. effect(() => console.log(state.count))
   └─ 创建 ReactiveEffect 实例
      └─ 执行 run() 方法
         └─ 设置 activeEffect
            └─ 执行用户函数
               └─ 访问 state.count
                  └─ 触发 get 拦截器
                     └─ 调用 track 收集依赖

3. state.count++
   └─ 触发 set 拦截器
      └─ 调用 trigger 触发更新
         └─ 查找相关依赖
            └─ 执行所有相关的 effect
               └─ 重新执行用户函数
```
## TargetMap and DepMap

让我用一个具体的例子来解释依赖图里存储的内容：

````typescript
// 创建一个响应式对象
const state = reactive({
  count: 0,
  message: 'hello'
})

// 创建三个 effect
effect(() => {
  console.log('effect1:', state.count)  // 只依赖 count
})

effect(() => {
  console.log('effect2:', state.message)  // 只依赖 message
})

effect(() => {
  console.log('effect3:', state.count, state.message)  // 同时依赖 count 和 message
})
````

此时依赖图的结构是这样的：

````typescript
// 1. targetMap (WeakMap)
targetMap = {
  // key: 原始对象
  {count: 0, message: 'hello'} => {
    // value: depsMap，存储这个对象所有属性的依赖
    "count" => Set([ effect1, effect3 ]),
    "message" => Set([ effect2, effect3 ])
  }
}

// 2. 每个 effect 的结构
effect1 = {
  fn: () => console.log('effect1:', state.count),
  deps: [ Set([ effect1, effect3 ]) ],  // 记录自己在哪些依赖集合中
  active: true
}

effect2 = {
  fn: () => console.log('effect2:', state.message),
  deps: [ Set([ effect2, effect3 ]) ],
  active: true
}

effect3 = {
  fn: () => console.log('effect3:', state.count, state.message),
  deps: [ 
    Set([ effect1, effect3 ]),  // count 的依赖集合
    Set([ effect2, effect3 ])   // message 的依赖集合
  ],
  active: true
}
````

当我们修改属性时：

````typescript
// 修改 count
state.count++
// 1. 通过 targetMap 找到原始对象的 depsMap
// 2. 通过 depsMap 找到 "count" 的依赖集合 Set([ effect1, effect3 ])
// 3. 执行这个集合中的所有 effect

// 修改 message
state.message = 'hi'
// 1. 找到 "message" 的依赖集合 Set([ effect2, effect3 ])
// 2. 执行这些 effect
````

用图表示就是：
````
targetMap (WeakMap)
└─ 原始对象 { count: 0, message: 'hello' }
   └─ depsMap (Map)
      ├─ "count" -> Set
      │   ├─ effect1
      │   └─ effect3
      │
      └─ "message" -> Set
          ├─ effect2
          └─ effect3

每个 effect 包含：
- fn: 用户传入的函数
- deps: 这个 effect 被收集到的所有依赖集合
- active: 是否处于激活状态
````

这样设计的好处：
1. 可以精确找到需要更新的 effect
2. 每个 effect 知道自己依赖了哪些属性
3. 支持一个 effect 依赖多个属性
4. 支持多个 effect 依赖同一个属性
5. 当属性变化时，只更新相关的 effect，不会触发无关的更新
