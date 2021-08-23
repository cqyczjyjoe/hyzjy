import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import request from 'vj/utils/request';
import AutoComplete from './AutoComplete';

// eslint-disable-next-line prefer-arrow-callback
const DomainSelectAutoComplete = forwardRef(function DomainSelectAutoComplete(props, ref) {
  const itemsFn = (query) => request.get('/domain/search', { q: query });

  /* const itemText = (domain) => {
      return domain.name;
  }; */

  const itemKey = (domain) => domain._id || domain;

  const renderItem = (domain) => (
    <div className="media">
      <div className="media__left medium">
        <img className="small domain-profile-avatar" src={domain.avatarUrl} alt="" width="30" height="30" />
      </div>
      <div className="media__body medium">
        <div className="domain-select__name">{domain.name}</div>
        <div className="domain-select__id">ID = {domain._id}</div>
      </div>
    </div>
  );

  return (
    <AutoComplete
      ref={ref}
      itemsFn={itemsFn}
      itemText={itemKey}
      itemKey={itemKey}
      renderItem={renderItem}
      {...props}
    />
  );
});

DomainSelectAutoComplete.propTypes = {
  width: PropTypes.string,
  height: PropTypes.string,
  name: PropTypes.string,
  listStyle: PropTypes.object,
  multi: PropTypes.bool,
  defaultItems: PropTypes.oneOfType([(PropTypes.arrayOf(PropTypes.any)), PropTypes.string]),
  allowEmptyQuery: PropTypes.bool,
};

DomainSelectAutoComplete.defaultProps = {
  width: '100%',
  height: 'auto',
  name: '',
  listStyle: {},
  multi: false,
  defaultItems: [],
  allowEmptyQuery: false,
};

DomainSelectAutoComplete.displayName = 'DomainSelectAutoComplete';

export default DomainSelectAutoComplete;
