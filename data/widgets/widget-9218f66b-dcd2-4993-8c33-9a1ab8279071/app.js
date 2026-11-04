(function() {
  const STORAGE_KEY = 'todo_items';
  
  let todos = [];

  function loadTodos() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        todos = JSON.parse(stored);
      } else {
        const isDemo = new URLSearchParams(location.search).get('tabId')?.startsWith('demo-tab-');
        todos = isDemo
          ? [
              { text: 'Review weekly metrics', completed: false },
              { text: 'Ship one small improvement', completed: true },
              { text: 'Plan tomorrow before shutdown', completed: false },
            ]
          : [];
        saveTodos();
      }
    } catch (e) {
      todos = [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      console.error('Erreur sauvegarde todos:', e);
    }
  }

  function render() {
    const list = document.getElementById('todo-list');
    const count = document.getElementById('count');
    
    if (!list) return;

    list.innerHTML = '';

    if (todos.length === 0) {
      list.innerHTML = '<li class="empty-state">Aucune tâche</li>';
      count.textContent = '0 tâche';
      return;
    }

    const activeCount = todos.filter(t => !t.completed).length;
    count.textContent = activeCount === 1 ? '1 tâche' : activeCount + ' tâches';

    todos.forEach((todo, index) => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.completed ? ' completed' : '');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.completed;
      checkbox.addEventListener('change', () => toggleTodo(index));

      const span = document.createElement('span');
      span.textContent = todo.text;

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', () => deleteTodo(index));

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  }

  function addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    
    todos.unshift({ text: trimmed, completed: false });
    saveTodos();
    render();
  }

  function toggleTodo(index) {
    todos[index].completed = !todos[index].completed;
    saveTodos();
    render();
  }

  function deleteTodo(index) {
    todos.splice(index, 1);
    saveTodos();
    render();
  }

  function clearCompleted() {
    todos = todos.filter(t => !t.completed);
    saveTodos();
    render();
  }

  const input = document.getElementById('todo-input');
  const addBtn = document.getElementById('add-btn');
  const clearBtn = document.getElementById('clear-completed');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (input) addTodo(input.value);
    });
  }

  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTodo(input.value);
        input.value = '';
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearCompleted);
  }

  loadTodos();
  render();
})();