window.onload = function() {
    Vue.component('data-picker', {
        props: ['value'],
        template: '<input placeholder="shedule" class="short-date"/>',
        data: function() {
            return {
                options: {
                    autoHide : true, 
                    format: "yyyy.mm.dd",
                    offset: 5,
                    weekStart: 1
                }
            }
        },
        mounted: function () {
            var vm = this
            $(this.$el)
                .datepicker(this.options)
                .val(this.value)
                .trigger('change')
                .on('change', function () {
                    vm.$emit('input', this.value)
                })
                .on('focus', function () {
                    vm.$emit('show')
                })
        },
        watch: {
            value: function (value) {
                $(this.$el)
                    .val(value)
                    .trigger('change')
            }
        },
        destroyed: function () {
            $(this.$el).off()
        }
    })
    Vue.component('list-item', {
        props: ['todo'],
        template: task,
        data: function() {
            return {
                visible: true,
                modify: false,
                description: this.todo.description,
                due: this.todo.due,
                duration: this.todo.duration,
                assign: this.todo.assign,
                label: this.todo.label,
                priority: this.todo.priority,
                subtask: this.todo.subtask
            }            
        },
        computed : {
            position: function() {
                var indent = this.subtask
                if (app.project == '' || app.user != '' ) indent = false
                var subtask = { 'my-indent' : indent }
                return subtask
            },
            project: function() {
                return app.project
            }
        },
        methods: {
            drag: function() {
                app.drag = this.todo._id
            },
            drop: function(ev) {
                pos1 = app.tasks.findIndex( task => task._id == app.drag);
                pos2 = app.tasks.findIndex( task => task._id == this.todo._id);
                if (pos1 == pos2) {
                    if (this.modify) this.subtask = !this.subtask
                } else {
                    console.log("move",pos1, "to", pos2);
                    app.tasks.splice(pos2, 0, app.tasks.splice(pos1, 1)[0]);
                }
                app.drag = ""
                app.$forceUpdate()
            },
            goto: function() {
                if ( !this.modify && this.todo.label.length > 0 ) {
                    app.project = this.todo.label.toLowerCase() == "project" ? this.todo.description : this.todo.label
                    app.$router.push({ name: "project", params: { id: app.project} })
                } else {
                    this.show()
                }
            },
            show: function() {
                if (app.activeTask != this) app.activeTask.hide()
                app.activeTask = this
                this.modify = true
            },
            hide: function(e) {
                this.modify = false
            },
            save: function() { 
                this.todo.description = this.description
                this.todo.due = this.due
                this.todo.shedule = this.due
                this.todo.duration = this.duration
                this.todo.assign = this.assign
                this.todo.label = this.label
                this.todo.subtask = this.subtask
                this.todo.priority = this.priority
                app.dbo.update(this.todo)
                this.modify = false
            },
            remove: function() { 
                app.dbo.delete(this.todo)
                this.visible = false
            }
        }
    })
    Vue.component('todo-item', {
        props: ['due'],
        template: blank,
        data: function() {
            return {
                blank: false,
                description : "", 
                shedule: this.due, 
                duration: "", 
                assign: app.user,
                label: app.project
            } 
        },
        methods: {
            addTask: function(e) {
                var task = { 
                    description: this.description, 
                    label: this.label, 
                    shedule:  this.shedule, 
                    duration:  this.duration,
                    assign:  this.assign
                }
                app.dbo.insert(task)
                this.description = this.duration = ""
            },
            show: function(e) {
                if (app.activeTask != this) app.activeTask.hide()
                app.activeTask = this
                this.blank = true
            },
            hide: function(e) {
                this.blank = false
            }
        }
    })
    Vue.use(VueTreeNavigation)
    
    var view = {
        tasks: {
            template: taskslist,
            computed: {
                title: function() {
                    if (this.$route.meta.title) return this.$route.meta.title
                    if (this.$route.params.id) return this.$route.params.id
                    return this.$route.path.split("/")[1]
                },
                contents : function() {
                    var folder =  this.$route.path.split("/")[1]
                    return app.getContents(folder)
                }
            }
        },
        timeline: {
            template: "<transition name='fade'><div class='timeline' :name='filter'><h1>Timeline</h1><div id='timeline'></div></div></transition>",
            computed: {
                filter: function() {
                    return app.user
                }  
            },
            mounted: function() {
                this.draw()
            },
            updated: function() {
                this.draw()  
            },
            methods: {
                draw: function() {
                    var container = document.getElementById('timeline');
                    var chart = new google.visualization.Timeline(container);
                    var dataTable = new google.visualization.DataTable();
                    dataTable.addColumn({ type: "string", id: "Name" })
                    dataTable.addColumn({ type: "string", id: "Task"})
                    dataTable.addColumn({ type: "string", role: "tooltip",'p': { 'html': true  } })
                    dataTable.addColumn({ type: "datetime", id: "Start"})
                    dataTable.addColumn({ type: "datetime", id: "End"})
                    var tasks = app.getTasks()
                    $.each( tasks , function( index, task ) {
                        if ( task.shedule && task.assign.length ) {
                            var due = task.shedule.split(".")
                            var year = parseInt(due[0]), month = parseInt(due[1]) - 1, day = parseInt(due[2])
                            var start = new Date(year, month, day)
                            if (task.duration && task.duration.length > 0) {
                                var days = 0, hours = 0, min = 0
                                if (task.duration.indexOf("h") != -1 ) hours = task.duration.split("h")[0] * 3
                                if (task.duration.indexOf("min") != -1) min = task.duration.split("min")[0] * 3
                                var finish = new Date(year, month, day, hours, min) 
                            } else {
                                var finish = new Date(year, month, day + 1)
                            }
                            var tooltip = "<div><b>"+task.description+"</b></div><hr>"
                            tooltip += "<div><b>"+task.assign+":</b> "+task.shedule.replace(".","/")+"<br>"
                            var duration = task.duration ? task.duration : "1 day"
                            tooltip += "<b>Duration:</b> "+duration+"</div>"
                            var data = [ task.assign, task.description, tooltip, start, finish ]
                            dataTable.addRow(data)
                        }
                    })
                    var options = {
                        timeline: { showRowLabels: true, 
                                    showBarLabels: true, 
                                    colorByRowLabel: false,
                                    groupByRowLabel: true,
                                    singleColor: '#808080'
                        },
                        //backgroundColor: '#ffd',
                        hAxis: { 
                            format: 'M/d', 
                            gridlines: {  count: 4  } 
                        }
                    };
                    
                    google.visualization.events.addListener(chart, 'ready', function () {
                      var today = new Date().getMonth() + 1 + "/" + new Date().getDate()
                      $.each($('text'), function (index, label) {
                        if ($(label).text() == today) {
                            $(label).attr("fill","indianred")
                            $(label).attr("font-weight","bold")
                            $(label).attr("font-size","15")
                        }
                      });
                    });
                    
                    chart.draw(dataTable, options);
                    console.log("timeline")

                }
            }
        },
        none: {
            template: "<h3>404 Not found</h3>"
        }
    }
    
    var app = new Vue({
        el: '#app',
        data: {
            title: '',
            contents: [],
            loaded: false,
            blank: false,
            project: '',
            keyword: '',
            filter: '',
            user: '',
            data: [],
            items: [
                { name: 'Inbox', route: 'inbox' },
                { name: 'Today', route: 'today' },
                { name: 'Next 7 days', route: 'next7days' },
                { name: 'Not sheduled', route: 'nodate' },
                { name: 'Timeline', route: 'timeline' }
            ],
            taskslist : {},
            activeTask: { 
                hide: function() {} 
            },
            popup: false,
            visible: false,
            show: false,
            drag: '',
            dbo: {
                url: "https://tasks-db97.restdb.io/rest/tasks",
                settings: {
                    async: true,
                    crossDomain: true,
                    headers: {
                        "content-type": "application/json",
                        "x-apikey": "5ba624a0bd79880aab0a7683",
                        "cache-control": "no-cache"
                    }
                },
                query: function() {
                    this.settings.method = "GET"
                    this.settings.url = this.url + '?g={}&sort=shedule'
                    $.ajax(this.settings).done(function (response) {
                        app.data = []
                        $.each(response, function(key, task){
                            task.due = task.shedule
                            app.data.push(task)
                        });
                        app.loaded = true
                    });
                },
                insert: function(task) {
                    this.settings.method = "POST"
                    this.settings.url = this.url
                    this.settings.processData = false
                    this.settings.data = JSON.stringify(task)
                    $.ajax(this.settings).done(function (response) {
                        task._id = response._id
                        app.data.push(task);
                        console.log(task._id+" task created")
                    });
                },
                update: function(task) {
                    this.settings.method = "PUT"
                    this.settings.url = this.url + "/" + task._id;
                    this.settings.processData = false
                    this.settings.data = JSON.stringify(task)
                    $.ajax(this.settings).done(function (response) {
                        console.log(task._id+" task updated")
                    });
                },
                delete: function(task) {
                    var options = this.settings
                    options.method = "DELETE"
                    options.url = "https://tasks-db97.restdb.io/rest/tasks/" + task._id;
                    options.processData = false
                    options.data = ""
                    $.ajax(options).done(function (response) {
                        console.log(task._id+" task deleted")
                        app.dbo.query();
                    });
                }
            }
        },
    
        computed : {
            menu: function() {
                return this.items.concat([
                    { name: 'Labels', children: this.getProjects() },
                    { name: 'Filters', children: this.getFilters() }
                ])
            },
            tasks: function() {
                return this.data.sort(function(a,b){
                    if(a.priority) return -1
                    if(!a.priority) return 1
                })
            },
            index: function() {
                return this.$route.meta.index  ? this.$route.meta.index : Math.floor(Math.random() * 100) + 1;
            },
        },
    
        methods: {
            getProjects: function() {
                return [... new Set(this.tasks.filter( function(task) {
                    return task.label.length > 0 }).map( function(task) {
                        return task.label }))].sort().map(function(label) {
                            return { name: label.substring(0,16), route: "/projects/"+encodeURI(label) }
                })
            },
            getFilters: function() {
                var users = [], items = [], path = this.$route.path.split("/")
                var route = path[1] == 'projects' ? route =  path[1] + "/" +path[2] : path[1] 
                $.each(this.tasks, function(key, task){
                    if (task.assign && users.indexOf(task.assign) == -1) {
                        items.push({ name: "Assigned to " + task.assign, route: route+"/"+task.assign })
                        users.push(task.assign)
                    }
                });
                return items.sort(function(a,b){
                    if(a.name < b.name) return -1
                    if(a.name > b.name) return 1
                })
            },
            getLabel: function(params) {
                if (params == undefined) { day : 0 }
                var day = params.day || 0
                var date = new Date()
                date.setDate(date.getDate() + day)
                return date.toDateString()
            },
            getTasks: function(params) {
                if (params == undefined) {
                    return this.tasks.filter( function(task) {
                        if ( task.label.toLowerCase() == "project" ) return false
                        return app.user.length > 1 ? task.assign == app.user : true })
                        
                } else if (params.filter != undefined) {
                    return this.tasks.filter( function(task) {
                        if (app.user.length > 0 && task.assign != app.user) return false
                        var text = task.description + task.label
                        return text.toLowerCase().indexOf(app.filter.toLowerCase()) != -1 })
                        
                } else if (params.project != undefined) {
                    return this.tasks.filter( function(task) {
                        if (app.user.length > 0 && task.assign != app.user) return false
                        return task.label.toLowerCase() == params.project.toLowerCase()  
                    }).sort(function(a,b) {
                        return a.description > b.description
                    })

                } else if (params.daysLeft != undefined) {
                    return this.tasks.filter( function(task) {
                        if (app.user.length > 0 && task.assign!= app.user) return false
                        if (task.shedule && task.shedule.length > 0) {
                            var due = task.shedule.split(".")
                            var year = parseInt(due[0]), month = parseInt(due[1]) - 1, day = parseInt(due[2])
                            var deadline = new Date(year, month, day)
                            var now = new Date()
                            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                            var dateOffset = (24*60*60*1000)
                            var daysLeft = (deadline - today) / dateOffset
                            if (params.daysLeft == -1 && daysLeft < 0 || params.daysLeft == daysLeft ) return true
                        }
                        return false
                    })

                } else if (params.noDate) {
                    return this.tasks.filter( function(task) {
                        if (app.user.length > 0 && task.assign != app.user) return false
                        return task.shedule == undefined || task.shedule.length == 0
                    })
                }
                return []
            },
    
            getContents: function(folder) {
                var taskslist = []
                switch (folder) {
                    case "inbox":
                        taskslist.push({ blank: true, tasks: app.getTasks() })
                        break
                    case "today":
                        var overdue = app.getTasks({ daysLeft : -1 })
                        if (overdue.length > 0)
                            taskslist.push({ header: 'Overdue', style: 'red',  tasks: overdue  })
                        taskslist.push({ header: 'Today', blank: true, tasks: app.getTasks({ daysLeft : 0 }), label: app.getLabel({ day: 0 }) })
                        break
                    case "next7days":
                        var overdue = app.getTasks({ daysLeft : -1 })
                        if (overdue.length > 0)
                            taskslist.push({ header: 'Overdue', style: 'red',  tasks: overdue })
                        taskslist.push({ header: 'Today', blank: true, tasks: app.getTasks({ daysLeft : 0 }), label: app.getLabel({ day: 0 }) })
                        taskslist.push({ header: 'Tomorrow', blank: true, tasks: app.getTasks({ daysLeft : 1 }), label: app.getLabel({ day: 1 }) })
                        taskslist.push({ header: app.getLabel({ day: 2 }), blank: true, tasks: app.getTasks({ daysLeft : 2 }) })
                        taskslist.push({ header: app.getLabel({ day: 3 }), blank: true, tasks: app.getTasks({ daysLeft : 3 }) })
                        taskslist.push({ header: app.getLabel({ day: 4 }), blank: true, tasks: app.getTasks({ daysLeft : 4 }) })
                        taskslist.push({ header: app.getLabel({ day: 5 }), blank: true, tasks: app.getTasks({ daysLeft : 5 }) })
                        taskslist.push({ header: app.getLabel({ day: 6 }), blank: true, tasks: app.getTasks({ daysLeft : 6 }) })
                        break
                    case "nodate":
                        taskslist.push({ blank: true, tasks: app.getTasks({ noDate: true }) })
                        break
                    case "projects":
                        taskslist.push({ blank: true, tasks:app.getTasks({ project : this.$route.params.id }).sort(function(a,b){
                            return (a.description > b.description) - (a.description < b.description)
                        }) })
                        break
                    case "search":
                        taskslist.push({ blank: false, tasks:app.getTasks({ filter : this.filter }) })
                }
                return taskslist
            }, 
    
            search: function() {
                console.log("search "+this.keyword)
                setTimeout( function() {
                    $("#refresh").focus()
                }, 200);
                this.filter = this.keyword
                this.$router.push({ path: "/search", query: { text: this.keyword } })
            },
    
            reload: function() {
                console.log("refresh")  
                this.dbo.query()  
            },
            
            reshedule: function() {
                var ask = confirm("Reshedule tasks to next day?")
                if (ask == false) return
                for (var n in this.data) {
                    var task = this.data[n], last = n == this.data.length - 1 ? true : false
                    if ( task.shedule && task.shedule != "" ) {
                        var due = task.shedule.split(".")
                        var shedule = new Date(parseInt(due[0]),parseInt(due[1])-1,parseInt(due[2])+1)
                        shedule = shedule.toLocaleDateString().replace(/-/g,".")
                        console.log(task.shedule+" resheduling to "+shedule+"...")
                        task.shedule = shedule
                        this.dbo.update(task)
                    }
                }
            },
    
            login: function() {
                window.location.assign('https://tasks-db97.restdb.io/home/db/tasks-db97')  
            }
        },
        
        router : new VueRouter({
            //mode: 'history',
            routes : [
                { path: '/', redirect: '/today' },
                { path: '/inbox', component: view.tasks, meta: { title: 'Inbox' } },
                { path: '/today', component: view.tasks, meta: { title: 'Today' } },
                { path: '/next7days', component: view.tasks, meta: { title: 'Next 7 days' } },
                { path: '/timeline', component: view.timeline },
                { path: '/timeline/:user', component: view.timeline },
                { path: '/projects/:id', name: 'project', component: view.tasks },
                { path: '/projects/:id/:user', component: view.tasks },
                { path: '/inbox/:user', component: view.tasks, meta: { title: 'Inbox' } },
                { path: '/today/:user', component: view.tasks, meta: { title: 'Today' } },
                { path: '/next7days/:user', component: view.tasks, meta: { title: 'Next 7 days' } },
                { path: '/nodate', component: view.tasks, meta: { title: 'Not sheduled' } },
                { path: '/nodate/:user', component: view.tasks, meta: { title: 'Not sheduled' } },
                { path: '/search', component: view.tasks, meta: { title: 'Search results' } }
            ],
            scrollBehavior(to, from, savedPosition) {
                return { x: 0, y: 0 }
            }
        }),
        
        watch: {
            '$route' (to, from) {
                this.user =  this.$route.params.user ? this.$route.params.user : ''
                this.keyword = this.filter = this.$route.query.text ? this.$route.query.text : ''
                this.project = this.$route.params.id ? decodeURI(this.$route.params.id) : ''
            }
        }
        
    }).$mount('#app')
    app.dbo.query()
    google.charts.load('current', {'packages':['timeline'], 'language': 'lt' });
    $(".menu").click(function() {
        $(".controls, .my-view, .my-sidebar").toggle()
        $(".my-sidebar a").off().click(function(){
            $(".controls, .my-view, .my-sidebar").toggle()
        })
    });
}
