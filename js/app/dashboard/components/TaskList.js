import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import moment from 'moment'
import { Droppable } from "@hello-pangea/dnd"
import { useTranslation } from 'react-i18next'
import _ from 'lodash'
import { Tooltip } from 'antd'
import Popconfirm from 'antd/lib/popconfirm'
import classNames from 'classnames'

import Task from './Task'

import Avatar from '../../components/Avatar'
import { unassignTasks, togglePolyline, optimizeTaskList, onlyFilter, toggleTaskListPanelExpanded } from '../redux/actions'
import { selectExpandedTaskListPanelsIds, selectPolylineEnabledByUsername, selectSettings, selectVisibleTaskIds } from '../redux/selectors'
import Tour from './Tour'
import { getDroppableListStyle } from '../utils'
import ProgressBar from './ProgressBar'
import { selectTaskListByUsername, selectTaskListTasksByUsername, selectTaskListWeight } from '../../../shared/src/logistics/redux/selectors'
import { formatDistance, formatDuration, formatWeight } from '../redux/utils'

moment.locale($('html').attr('lang'))

const TaskOrTour = ({ item, draggableIndex, unassignTasksFromTaskList }) => {

  if (item.startsWith('/api/tours')) {
    return (<Tour tourId={ item } draggableIndex={ draggableIndex } />)
  } else {
    return (<Task taskId={ item } draggableIndex={ draggableIndex } onRemove={ item => unassignTasksFromTaskList(item) } />)
  }
}

// OPTIMIZATION
// Avoid useless re-rendering when starting to drag
// @see https://egghead.io/lessons/react-optimize-performance-in-@hello-pangea/dnd-with-shouldcomponentupdate-and-purecomponent
class InnerList extends React.Component {

  shouldComponentUpdate(nextProps) {
    if (nextProps.items === this.props.items) {
      return false
    }

    return true
  }

  render() {
    return _.map(this.props.items,
      (item, index) => <TaskOrTour
        key={ item }
        item={ item }
        draggableIndex={ index }
        unassignTasksFromTaskList={ this.props.unassignTasksFromTaskList }
      />)
  }
}

// OPTIMIZATION
// Use React.memo to avoid re-renders when percentage hasn't changed
const ProgressBarMemo = React.memo(({
  completedTasks, inProgressTasks, cancelledTasks,
  failureTasks, tasks, t
}) => {

    const completedPer = completedTasks / tasks * 100
    const inProgressPer = inProgressTasks / tasks * 100
    const failurePer = failureTasks / tasks * 100
    const cancelledPer = cancelledTasks / tasks * 100
    const title = (
      <table style={{ width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: '10px' }}><span style={{ color: '#28a745' }}>●</span> {t('ADMIN_DASHBOARD_TOOLTIP_COMPLETED')}</td>
            <td style={{ textAlign: 'right' }}>{completedTasks}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: '10px' }}><span style={{ color: '#ffc107' }}>●</span> {t('ADMIN_DASHBOARD_TOOLTIP_FAILED')}</td>
            <td style={{ textAlign: 'right' }}>{failureTasks}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: '10px' }}><span style={{ color: '#dc3545' }}>●</span> {t('ADMIN_DASHBOARD_TOOLTIP_CANCELLED')}</td>
            <td style={{ textAlign: 'right' }}>{cancelledTasks}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: '10px' }}><span style={{ color: '#337ab7' }}>●</span> {t('ADMIN_DASHBOARD_TOOLTIP_IN_PROGRESS')}</td>
            <td style={{ textAlign: 'right' }}>{inProgressTasks}</td>
          </tr>
          <tr>
            <td>───</td>
            <td></td>
          </tr>
          <tr>
            <td style={{ paddingRight: '10px' }}>{t('ADMIN_DASHBOARD_TOOLTIP_TOTAL')}</td>
            <td style={{ textAlign: 'right' }}>{tasks}</td>
          </tr>
        </tbody>
      </table>
    )

    return (
        <Tooltip title={title}>
          <div>
            <ProgressBar width="100%" height="8px" backgroundColor="white" segments={[
              {value: `${completedPer}%`, color: '#28a745'},
              {value: `${failurePer}%`, color: '#ffc107'},
              {value: `${cancelledPer}%`, color: '#dc3545'},
              {value: `${inProgressPer}%`, color: '#337ab7'},
            ]} />
          </div>
        </Tooltip>
    )
  })

export const TaskList = ({ uri, username, distance, duration, taskListsLoading }) => {
  const dispatch = useDispatch()
  const unassignTasksFromTaskList = (username => tasks => dispatch(unassignTasks(username, tasks)))(username)

  const taskList = useSelector(state => selectTaskListByUsername(state, {username: username}))
  const items = taskList.items
  const tasks = useSelector(state => selectTaskListTasksByUsername(state, {username: username}))
  const visibleTaskIds = useSelector(selectVisibleTaskIds)

  const { showWeightAndVolumeUnit } = useSelector(selectSettings)

  const visibleTasks = tasks.filter(task => {
    return _.includes(visibleTaskIds, task['@id'])
  })

  const expandedTaskListPanelsIds = useSelector(selectExpandedTaskListPanelsIds)
  const isExpanded = expandedTaskListPanelsIds.includes(taskList['@id'])

  const polylineEnabled = useSelector(selectPolylineEnabledByUsername(username))

  const { t } = useTranslation()

  const uncompletedTasks = _.filter(visibleTasks, t => t.status === 'TODO')
  const completedTasks = _.filter(visibleTasks, t => t.status === 'DONE')
  const inProgressTasks = _.filter(visibleTasks, t => t.status === 'DOING')
  const failureTasks = _.filter(visibleTasks, t => t.status === 'FAILED')
  const cancelledTasks = _.filter(visibleTasks, t => t.status === 'CANCELLED')
  const incidentReported = _.filter(visibleTasks, t => t.hasIncidents)

  const durationFormatted = formatDuration(duration)
  const distanceFormatted = formatDistance(distance)
  const weightFormatted = formatWeight(useSelector(state => selectTaskListWeight(state, {username: username})))

  return (
    <div>
      <div className="pl-2 task-list__header" onClick={() => dispatch(toggleTaskListPanelExpanded(taskList['@id']))}>
          <div>
            <span>
              <Avatar username={ username } size="24" />
              <small className="text-monospace ml-2">
                <strong className="mr-2">{ username }</strong>
                <span className="text-muted">{ `(${tasks.length})` }</span>
              </small>
            </span>
            { visibleTasks.length > 0 && (
            <div style={{ width: '33.3333%' }}>
              <ProgressBarMemo
                  completedTasks={ completedTasks.length }
                  tasks={ visibleTasks.length }
                  inProgressTasks={ inProgressTasks.length }
                  incidentReported={ incidentReported.length }
                  failureTasks={ failureTasks.length }
                  cancelledTasks={ cancelledTasks.length }
                  t={t.bind(this)}
                />
            </div>
            ) }
            {incidentReported.length > 0 && <div onClick={(e) => {
              dispatch(onlyFilter('showIncidentReportedTasks'))
              e.stopPropagation()
            }}>
              <Tooltip title="Incident(s)">
                <span className='fa fa-warning text-warning' /> <span className="text-secondary">({incidentReported.length})</span>
              </Tooltip>
            </div>}
            <Popconfirm
              placement="left"
              title={ t('ADMIN_DASHBOARD_UNASSIGN_ALL_TASKS') }
              onConfirm={ () => dispatch(unassignTasks(username, uncompletedTasks)) }
              okText={ t('CROPPIE_CONFIRM') }
              cancelText={ t('ADMIN_DASHBOARD_CANCEL') }>
              <a href="#"
                className="text-reset mr-2"
                style={{ visibility: uncompletedTasks.length > 0 ? 'visible' : 'hidden' }}
                onClick={ e => e.preventDefault() }>
                <i className="fa fa-lg fa-times"></i>
              </a>
            </Popconfirm>
          </div>
          <div>
            <span>{ durationFormatted }</span>
            <span className="mx-2">—</span>
            <span>{ distanceFormatted }</span>
            { showWeightAndVolumeUnit ?
              (
                <>
                  <span className="mx-2">—</span>
                  <span>{ weightFormatted }</span>
                </>
              )
              : null
            }
          </div>
      </div>
      <div className={classNames({"panel-collapse": true,  "collapse": true, "in": isExpanded})}>
        { tasks.length > 0 && (
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <a href="#"
                title="Optimize"
                style={{
                  color: '#f1c40f',
                  visibility: tasks.length > 1 ? 'visible' : 'hidden'
                }}
                onClick={ e => {
                  e.preventDefault()
                  dispatch(optimizeTaskList({'@id': uri, username: username}))
                }}
              >
                <i className="fa fa-2x fa-bolt"></i>
              </a>
              <a role="button"
                className={ classNames({
                  'ml-3': true,
                  'invisible': tasks.length < 1,
                  'text-muted': !polylineEnabled
                }) }
                onClick={ () => dispatch(togglePolyline(username)) }
              >
                <i className="fa fa-map fa-2x"></i>
              </a>
            </div>
          </div>
        )}
        <Droppable
          droppableId={ `assigned:${username}` }
          key={tasks.length} // assign a mutable key to trigger a re-render when inserting a nested droppable (for example : a tour)
          isDropDisabled={ taskListsLoading }
        >
          {(provided, snapshot) => (
            <div ref={ provided.innerRef }
              className={ classNames({
                'taskList__tasks': true,
                'list-group': true,
                'm-0': true,
              }) }
              { ...provided.droppableProps }
              style={getDroppableListStyle(snapshot.isDraggingOver)}
            >
              <InnerList
                items={ items }
                unassignTasksFromTaskList={ unassignTasksFromTaskList }
                username={ username } />
              { provided.placeholder }
            </div>
          )}
        </Droppable>
      </div>
    </div>
  )
}





export default TaskList
